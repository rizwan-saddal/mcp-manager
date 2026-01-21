# /// script
# dependencies = ["mcp", "pydantic"]
# ///

import asyncio
import json
import os
import sys
from typing import Any, Dict, List, Optional
import subprocess

# Determine the absolute path to the repository root
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Ensure mcp is installed or available
try:
    from mcp.server import Server
    from mcp.types import Tool, TextContent, ImageContent, EmbeddedResource
    import mcp.types as types
    from mcp.server.stdio import stdio_server
except ImportError:
    # Fallback or error if deps are missing (should be installed via requirements.txt)
    sys.stderr.write("Error: mcp package not found. Install requirements.txt.\n")
    sys.exit(1)

server = Server("mcp-manager-router")

MANIFEST_PATH = os.path.join(REPO_ROOT, "router_manifest.json")

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
    
    if not tool_def:
        raise ValueError(f"Tool {name} not found")

    command_template = tool_def["command"] # e.g. ["uv", "run", "python/simple_tool.py"]
    
    # Prepare environment
    env = os.environ.copy()
    env["MCP_ARGUMENTS"] = json.dumps(arguments)
    env["PYTHONUNBUFFERED"] = "1"

    # Construct command with absolute paths where necessary
    cmd_list = []
    for part in command_template:
        # Check if part looks like a file in the repo and make it absolute
        possible_path = os.path.join(REPO_ROOT, part)
        if os.path.exists(possible_path):
             cmd_list.append(possible_path)
        else:
             cmd_list.append(part)

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd_list,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        
        stdout, stderr = await process.communicate()
        
        output_text = stdout.decode().strip()
        error_text = stderr.decode().strip()

        if process.returncode != 0:
             # Include stderr in the output for debugging
             return [types.TextContent(type="text", text=f"Error executing tool {name}:\n{error_text}\nOutput:\n{output_text}")]

        # If strict output format is needed, we could parse JSON here. For now return raw stdout.
        return [types.TextContent(type="text", text=output_text if output_text else "Success (No Output)")]

    except Exception as e:
        return [types.TextContent(type="text", text=f"Exception running tool: {str(e)}")]

async def main():
    # Run the server on stdio
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
