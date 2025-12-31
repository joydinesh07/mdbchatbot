import asyncio
import os
import json
import sys

MCP_SERVER_SCRIPT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../mcp-server/dist/index.js"))

async def main():
    print(f"Launching: node {MCP_SERVER_SCRIPT}")
    process = await asyncio.create_subprocess_exec(
        "node", MCP_SERVER_SCRIPT,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    print("Process started. Waiting for logs...")
    
    # Read stderr in background
    async def read_stderr():
        while True:
            line = await process.stderr.readline()
            if not line: break
            print(f"STDERR: {line.decode().strip()}")
    
    asyncio.create_task(read_stderr())

    # Send Initialize
    init_msg = {
        "jsonrpc": "2.0",
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05", # Try matching what we saw
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0"}
        },
        "id": 1
    }
    
    print("Sending init...")
    process.stdin.write(json.dumps(init_msg).encode() + b"\n")
    await process.stdin.drain()
    print("Init sent. Reading stdout...")

    # Read response
    response_line = await process.stdout.readline()
    print(f"STDOUT: {response_line.decode().strip()}")

    process.terminate()

if __name__ == "__main__":
    asyncio.run(main())
