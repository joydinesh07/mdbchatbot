import os
import sys
import asyncio
import json
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from google.generativeai.types import content_types
from google.protobuf import struct_pb2
from dotenv import load_dotenv

load_dotenv()

# Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("Error: GEMINI_API_KEY not found in .env")
    sys.exit(1)

genai.configure(api_key=GEMINI_API_KEY)
MODEL_NAME = "gemini-2.0-flash-lite-preview-02-05"

MCP_SERVER_SCRIPT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../mcp-server/dist/index.js"))

if not os.path.exists(MCP_SERVER_SCRIPT):
    print(f"Error: MCP Server script not found at {MCP_SERVER_SCRIPT}")
    sys.exit(1)

# --- Custom Simple MCP Client ---
class SimpleMCPClient:
    def __init__(self, script_path):
        self.script_path = script_path
        self.process = None
        self.msg_id = 0
        self.pending_requests = {}
        self.read_task = None
        self.connected = False

    async def start(self):
        print(f"SimpleMCPClient: Launching node {self.script_path}")
        self.process = await asyncio.create_subprocess_exec(
            "node", self.script_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        self.read_task = asyncio.create_task(self._read_loop())
        asyncio.create_task(self._monitor_stderr())
        
        await self._send_initialize()
        self.connected = True
        print("SimpleMCPClient: Connected and Initialized.")

    async def stop(self):
        if self.process:
            self.process.terminate()
        if self.read_task:
            self.read_task.cancel()

    async def _send_initialize(self):
        response = await self.request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "simple-client", "version": "1.0"}
        })
        await self.notify("notifications/initialized", {})
        return response

    async def list_tools(self):
        response = await self.request("tools/list", {})
        return response.get("tools", [])

    async def call_tool(self, name, arguments):
        response = await self.request("tools/call", {
            "name": name,
            "arguments": arguments
        })
        return response

    async def request(self, method, params):
        self.msg_id += 1
        cid = self.msg_id
        msg = {
            "jsonrpc": "2.0",
            "id": cid,
            "method": method,
            "params": params
        }
        
        future = asyncio.get_running_loop().create_future()
        self.pending_requests[cid] = future
        
        data = json.dumps(msg).encode() + b"\n"
        try:
            self.process.stdin.write(data)
            await self.process.stdin.drain()
            return await asyncio.wait_for(future, timeout=30.0)
        except Exception as e:
            if cid in self.pending_requests:
                del self.pending_requests[cid]
            raise e

    async def notify(self, method, params):
        msg = {"jsonrpc": "2.0", "method": method, "params": params}
        data = json.dumps(msg).encode() + b"\n"
        self.process.stdin.write(data)
        await self.process.stdin.drain()

    async def _read_loop(self):
        try:
            while True:
                line = await self.process.stdout.readline()
                if not line: break
                line_str = line.decode().strip()
                if not line_str: continue
                try:
                    data = json.loads(line_str)
                    if "id" in data and data["id"] in self.pending_requests:
                        future = self.pending_requests[data["id"]]
                        if "error" in data:
                            future.set_exception(Exception(data["error"]["message"]))
                        else:
                            future.set_result(data.get("result", {}))
                        del self.pending_requests[data["id"]]
                except Exception as e:
                    print(f"SimpleMCP: Error processing line: {e}")
        except:
            pass

    async def _monitor_stderr(self):
        try:
            while True:
                line = await self.process.stderr.readline()
                if not line: break
                print(f"MCP_LOG: {line.decode().strip()}")
        except:
            pass

# --- FastAPI App ---

mcp_client: SimpleMCPClient | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mcp_client
    mcp_client = SimpleMCPClient(MCP_SERVER_SCRIPT)
    try:
        await mcp_client.start()
        yield
        await mcp_client.stop()
    except Exception as e:
        print(f"Statsup Error: {e}")
        raise e

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

def sanitize_schema_for_gemini(schema):
    """
    Recursively convert JSON Schema types to Uppercase to match Gemini Enums.
    """
    if not isinstance(schema, dict):
        return schema
        
    new_schema = schema.copy()
    
    if "type" in new_schema:
        if isinstance(new_schema["type"], str):
            new_schema["type"] = new_schema["type"].upper()
            
    if "properties" in new_schema:
        new_props = {}
        for k, v in new_schema["properties"].items():
            new_props[k] = sanitize_schema_for_gemini(v)
        new_schema["properties"] = new_props
        
    if "items" in new_schema:
        new_schema["items"] = sanitize_schema_for_gemini(new_schema["items"])
        
    return new_schema

def map_mcp_tools_to_gemini(mcp_tools):
    gemini_tools = []
    for tool in mcp_tools:
        raw_schema = tool.get("inputSchema", {})
        # FIX: Sanitize schema (lowercase 'object' -> 'OBJECT')
        clean_schema = sanitize_schema_for_gemini(raw_schema)
        
        declaration = {
            "name": tool["name"],
            "description": tool.get("description", ""),
            "parameters": clean_schema
        }
        gemini_tools.append(declaration)
    return gemini_tools

@app.post("/chat")
async def chat(request: ChatRequest):
    if not mcp_client or not mcp_client.connected:
         raise HTTPException(status_code=503, detail="MCP Server not connected")
    
    # 1. Fetch Tools
    mcp_tools_list = await mcp_client.list_tools()
    
    # 2. Configure Gemini with Tools
    gemini_tools_declarations = map_mcp_tools_to_gemini(mcp_tools_list)
    
    # Initialize Model with Tools
    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        tools=gemini_tools_declarations,
        system_instruction="You are a MongoDB DBA Assistant. Use the available tools to answer questions about the database status."
    )
    # Note: Enable automatic function calling to let the SDK handle the chat loop if possible,
    # but we need to intercept the execution to run via MCP.
    # So we keep it disabled and loop manually.
    chat_session = model.start_chat(enable_automatic_function_calling=False)
    
    try:
        # Send user message
        response = await chat_session.send_message_async(request.message)
        
        final_text = ""
        
        # Loop to handle function calls
        # We limit to 5 turns to prevent infinite loops
        for _ in range(5):
             if not response.candidates:
                 break
                 
             part = response.candidates[0].content.parts[0]
            
             if part.function_call:
                fc = part.function_call
                tool_name = fc.name
                tool_args = dict(fc.args) 
                
                print(f"Gemini requested tool: {tool_name} with args: {tool_args}")
                
                # Execute Tool
                try:
                    tool_result = await mcp_client.call_tool(tool_name, tool_args)
                    result_content = json.dumps(tool_result) 
                    
                    # Send result back to model
                    response = await chat_session.send_message_async(
                        genai.protos.Content(
                            parts=[genai.protos.Part(
                                function_response=genai.protos.FunctionResponse(
                                    name=tool_name,
                                    response={"result": result_content}
                                )
                            )]
                        )
                    )
                except Exception as e:
                     print(f"Tool execution failed: {e}")
                     final_text = f"Error executing tool {tool_name}: {str(e)}"
                     # If tool fails, simple break or tell model?
                     # Let's return error to model in real system, but here just break with error text
                     break
             else:
                # No function call, just text
                final_text = response.text
                break
                
        return {"response": final_text or "No response from AI."}

    except Exception as e:
        print(f"Gemini Error: {e}")
        # Improve error details
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
