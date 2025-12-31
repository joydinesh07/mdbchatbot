import os
import asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from dotenv import load_dotenv

load_dotenv()

MCP_SERVER_SCRIPT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../mcp-server/dist/index.js"))

async def main():
    print("Starting MCP Client Test...")
    server_params = StdioServerParameters(
        command="node",
        args=[MCP_SERVER_SCRIPT],
        env=os.environ
    )

    try:
        async with stdio_client(server_params) as (read, write):
            print("Connected to Stdio.")
            session = ClientSession(read, write)
            print("Initializing session...")
            await session.initialize()
            print("Session Initialized!")
            
            result = await session.list_tools()
            print("Tools:", [t.name for t in result.tools])
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
