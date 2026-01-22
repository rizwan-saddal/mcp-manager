# /// script
# dependencies = ["mcp", "pydantic"]
# ///

import asyncio
import json
import os
import sys
import time
import hashlib
import shutil
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

# Determine paths
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOGS_DIR = os.path.join(REPO_ROOT, "logs")
if not os.path.exists(LOGS_DIR):
    os.makedirs(LOGS_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOGS_DIR, "usage.jsonl")
MANIFEST_PATH = os.path.join(REPO_ROOT, "router_manifest.json")
COMMUNITY_PATH = os.path.join(os.path.dirname(__file__), "community_servers.json")

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

def get_command_hash(command: List[str], env: Dict[str, str]) -> str:
    # Include env in hash to ensure config changes trigger new servers
    data = json.dumps({"cmd": command, "env": env}, sort_keys=True)
    return hashlib.sha256(data.encode()).hexdigest()

def load_manifest() -> Dict:
    manifest = {"tools": []}
    
    # 1. Load User Manifest (Priority)
    if os.path.exists(MANIFEST_PATH):
        try:
            with open(MANIFEST_PATH, "r") as f:
                user_manifest = json.load(f)
                manifest["tools"].extend(user_manifest.get("tools", []))
        except Exception as e:
            sys.stderr.write(f"Error loading user manifest: {e}\n")

    # 2. Load Community Registry (Auto-Discovery)
    if os.path.exists(COMMUNITY_PATH):
        try:
            with open(COMMUNITY_PATH, "r") as f:
                community_manifest = json.load(f)
                # Only add if not already present by name
                existing_names = set(t["name"] for t in manifest["tools"])
                for tool in community_manifest.get("tools", []):
                    if tool["name"] not in existing_names:
                        manifest["tools"].append(tool)
        except Exception as e:
            sys.stderr.write(f"Error loading community registry: {e}\n")
            
    return manifest

def expand_vars(text: str) -> str:
    """Expand environment variables in format ${VAR} or $VAR"""
    return os.path.expandvars(text)

@server.list_tools()
async def list_tools() -> List[types.Tool]:
    manifest = load_manifest()
    tools = []
    
    # Add Router Internal Tools
    tools.append(types.Tool(
        name="configure_mcp_tool",
        description="Install or Configure an MCP tool. Use this to permanently add a tool from the registry to the manifest, or to save environment variables (like API keys).",
        inputSchema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Name of the tool to install/configure (e.g. 'weather', 'brave_search')"},
                "env": {
                    "type": "object", 
                    "additionalProperties": {"type": "string"},
                    "description": "Optional: Key-value pairs of environment variables. Leave empty if just installing."
                }
            },
            "required": ["name"]
        }
    ))
    
    tools.append(types.Tool(
        name="search_mcp_servers",
        description="CRITICAL: Use this tool whenever you lack the necessary tools, skills, or knowledge to complete a user request. It searches the expanded MCP registry to find and install new capabilities (e.g. 'browser', 'database', 'slack') on the fly.",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query for the missing capability (e.g. 'weather', 'database', 'browser')"}
            },
            "required": ["query"]
        }
    ))

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
    # Handle Internal Tools
    if name == "configure_mcp_tool":
        try:
            tool_name = arguments["name"]
            new_env = arguments.get("env", {})
            
            # 1. Load User Manifest (or create empty)
            user_manifest = {"tools": []}
            if os.path.exists(MANIFEST_PATH):
                try:
                    with open(MANIFEST_PATH, "r") as f:
                        user_manifest = json.load(f)
                except:
                    pass
            
            # 2. Find tool in User Manifest, or copy from Community
            tool_entry = next((t for t in user_manifest["tools"] if t["name"] == tool_name), None)
            
            if not tool_entry:
                # Look in Community
                if os.path.exists(COMMUNITY_PATH):
                    with open(COMMUNITY_PATH, "r") as f:
                        community = json.load(f)
                        comm_tool = next((t for t in community["tools"] if t["name"] == tool_name), None)
                        if comm_tool:
                            # Copy to User Manifest
                            tool_entry = comm_tool.copy()
                            user_manifest["tools"].append(tool_entry)
            
            if not tool_entry:
                return [types.TextContent(type="text", text=f"Error: Tool '{tool_name}' not found in registry.")]
            
            # 3. Update Env
            if "env" not in tool_entry:
                tool_entry["env"] = {}
            tool_entry["env"].update(new_env)
            
            # 4. Save
            with open(MANIFEST_PATH, "w") as f:
                json.dump(user_manifest, f, indent=2)
                
            return [types.TextContent(type="text", text=f"Successfully configured and saved settings for '{tool_name}'.")]
            
        except Exception as e:
            return [types.TextContent(type="text", text=f"Error configuring tool: {e}")]

    if name == "search_mcp_servers":
        try:
            query = arguments["query"].lower()
            results = []
            
            # Load Registry
            if os.path.exists(COMMUNITY_PATH):
                with open(COMMUNITY_PATH, "r") as f:
                    community = json.load(f)
                    for tool in community.get("tools", []):
                        if query in tool["name"].lower() or query in tool.get("description", "").lower():
                            results.append({
                                "name": tool["name"],
                                "description": tool.get("description", ""),
                                "command_preview": " ".join(tool["command"]),
                                "inputSchema": tool.get("inputSchema", {})
                            })
            
            return [types.TextContent(type="text", text=json.dumps(results, indent=2))]
        except Exception as e:
            return [types.TextContent(type="text", text=f"Error searching registry: {e}")]


    manifest = load_manifest()
    tool_def = next((t for t in manifest.get("tools", []) if t["name"] == name), None)
    
    start_time = time.time()
    success = False
    error_msg = None

    if not tool_def:
        return [types.TextContent(type="text", text=f"Tool {name} not found")]

    command = tool_def["command"]
    
    # Resolve absolute paths and expand variables in command
    final_cmd = []
    for i, part in enumerate(command):
        # Expand vars first (e.g. ${DB_PATH})
        expanded_part = expand_vars(part)
        
        # Check for absolute paths relative to repo root
        possible_path = os.path.join(REPO_ROOT, expanded_part)
        if os.path.exists(possible_path):
             final_cmd.append(possible_path)
        else:
             # Logic for executable resolution (first arg)
             if i == 0 and not os.path.isabs(expanded_part):
                 resolved = shutil.which(expanded_part)
                 if resolved:
                     final_cmd.append(resolved)
                 else:
                     final_cmd.append(expanded_part)
             else:
                 final_cmd.append(expanded_part)
    
    # ENV preparation
    env = os.environ.copy()
    if tool_def.get("env"):
        env.update(tool_def["env"])
    env["PYTHONUNBUFFERED"] = "1"
    
    # Calculate hash including env
    cmd_hash = get_command_hash(final_cmd, env)

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
