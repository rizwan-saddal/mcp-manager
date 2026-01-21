import json
import os
import sys

def migrate():
    config_path = "mcp-config.json"
    manifest_path = "router_manifest.json"

    if not os.path.exists(config_path):
        print(f"No {config_path} found. Nothing to migrate.")
        return

    with open(config_path, "r") as f:
        old_config = json.load(f)

    tools = []
    
    # Iterate over old servers
    for server_name, server_config in old_config.get("mcpServers", {}).items():
        print(f"Migrating server: {server_name}")
        
        # Construct full command list
        command = server_config.get("command")
        args = server_config.get("args", [])
        
        full_command = []
        if command:
            full_command.append(command)
        full_command.extend(args)

        # We cannot know the tools without running the server.
        # We will create a placeholder.
        tools.append({
            "name": f"{server_name}_proxy_tool",
            "description": f"Imported from {server_name}. PLEASE UPDATE manually with specific tool names and input schemas.",
            "command": full_command if full_command else ["echo", "check_command"],
            "inputSchema": {}
        })

    new_manifest = {"tools": tools}
    
    with open(manifest_path, "w") as f:
        json.dump(new_manifest, f, indent=2)
    
    print(f"Migration complete. Created {manifest_path}. Please review and update tool definitions.")

if __name__ == "__main__":
    migrate()
