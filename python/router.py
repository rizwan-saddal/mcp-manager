# /// script
# dependencies = ["mcp", "pydantic"]
# ///

import asyncio
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

# Determine paths
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOGS_DIR = os.path.join(REPO_ROOT, "logs")
if not os.path.exists(LOGS_DIR):
    os.makedirs(LOGS_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOGS_DIR, "usage.jsonl")
MANIFEST_PATH = os.path.join(REPO_ROOT, "router_manifest.json")

# Import MCP
try:
    from mcp.server import Server
    from mcp.types import Tool, TextContent, ImageContent, EmbeddedResource
    import mcp.types as types
    from mcp.server.stdio import stdio_server
    from mcp.client.stdio import stdio_client, StdioServerParameters
    from mcp.client.session import ClientSession
except ImportError:
    sys.stderr.write("Error: mcp package not found.\n")
    sys.exit(1)

server = Server("mcp-manager-router")

@dataclass
class ActiveServer:
    process: Any
    session: ClientSession
    command_hash: str
    exit_stack: Any

# Global state for active downstream servers
# Map command_hash -> ActiveServer
active_servers: Dict[str, ActiveServer] = {}

def get_command_hash(command: List[str]) -> str:
    return json.dumps(command)

def load_manifest() -> Dict:
    if not os.path.exists(MANIFEST_PATH):
        return {"tools": []}
    try:
        with open(MANIFEST_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        sys.stderr.write(f"Error loading manifest: {e}\n")
        return {"tools": []}

@server.list_tools()
async def list_tools() -> List[types.Tool]:
    manifest = load_manifest()
    tools = []
    for tool_def in manifest.get("tools", []):
         # If strict, we might need to conform to types.Tool inputSchema structure
         # For now, pass through
        tools.append(
            types.Tool(
                name=tool_def["name"],
                description=tool_def.get("description", ""),
                inputSchema=tool_def.get("inputSchema", {})
            )
        )
    return tools

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> List[types.TextContent | types.ImageContent | types.EmbeddedResource]:
    manifest = load_manifest()
    tool_def = next((t for t in manifest.get("tools", []) if t["name"] == name), None)
    
    start_time = time.time()
    success = False
    error_msg = None

    if not tool_def:
        return [types.TextContent(type="text", text=f"Tool {name} not found")]

    command = tool_def["command"]
    cmd_hash = get_command_hash(command)
    
    # Resolve absolute paths in command
    final_cmd = []
    for part in command:
        possible_path = os.path.join(REPO_ROOT, part)
        if os.path.exists(possible_path):
             final_cmd.append(possible_path)
        else:
             final_cmd.append(part)

    # ENV preparation
    env = os.environ.copy()
    if tool_def.get("env"):
        env.update(tool_def["env"])
    env["PYTHONUNBUFFERED"] = "1"

    try:
        session = None
        
        # 1. Check if server is already running
        if cmd_hash in active_servers:
            session = active_servers[cmd_hash].session
        else:
            # 2. Start new server
            # We use mcp.client.stdio to manage the connection
            # We need to manually manage the exit stack context to keep it alive
            from contextlib import AsyncExitStack
            stack = AsyncExitStack()
            
            # Create params
            server_params = StdioServerParameters(
                command=final_cmd[0],
                args=final_cmd[1:],
                env=env
            )
            
            # Connect
            read, write = await stack.enter_async_context(stdio_client(server_params))
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
            
            # Store
            active_servers[cmd_hash] = ActiveServer(
                process=None, # stdio_client manages process internally or we don't access it easily, but session is what matters
                session=session,
                command_hash=cmd_hash,
                exit_stack=stack
            )

        # 3. Call Tool via JSON-RPC
        # We assume the downstream server exposes the tool with the SAME Name.
        # If the manifest name is just an alias, we should fail or have a mapping.
        # For now, we assume direct mapping.
        result = await session.call_tool(name, arguments)
        
        success = True
        return result.content

    except Exception as e:
        error_msg = str(e)
        return [types.TextContent(type="text", text=f"Error calling tool {name}: {e}")]

    finally:
        duration = time.time() - start_time
        try:
            log_entry = {
                "timestamp": time.time(),
                "iso_time": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()),
                "tool": name,
                "success": success,
                "duration": duration,
                "error": error_msg
            }
            with open(LOG_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry) + "\n")
        except:
            pass

async def main():
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
