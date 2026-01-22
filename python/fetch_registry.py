import json
import re
import urllib.request
import os

COMMUNITY_PATH = os.path.join(os.path.dirname(__file__), "community_servers.json")

def fetch_content(url):
    try:
        with urllib.request.urlopen(url) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

def parse_markdown_list(content):
    servers = []
    # Regex for "- [Name](URL) - Description" or similar
    # Captures: Name, URL, Description
    pattern = r'-\s+\[(.*?)\]\((.*?)\)\s*[-:]\s*(.*)'
    
    for line in content.splitlines():
        match = re.search(pattern, line)
        if match:
            name = match.group(1).strip()
            url = match.group(2).strip()
            description = match.group(3).strip()
            
            # Simple heuristic to identify "servers" vs other links
            if "mcp" in name.lower() or "server" in name.lower() or "mcp" in description.lower() or "server" in url.lower():
                 servers.append({
                    "name": name,
                    "url": url,
                    "description": description,
                    # We don't know the exact command, but we can provide a hint or leave it empty.
                    # The Agent will rely on the description to pick it.
                    "command": [], 
                    "inputSchema": {} # Discovery only
                })
    return servers

def main():
    sources = [
        "https://raw.githubusercontent.com/wong2/awesome-mcp-servers/main/README.md",
        "https://raw.githubusercontent.com/modelcontextprotocol/servers/main/README.md"
    ]
    
    all_servers = []
    
    # 1. Load existing manual registry to preserve "golden" entries
    existing_tools = []
    if os.path.exists(COMMUNITY_PATH):
        try:
            with open(COMMUNITY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                existing_tools = data.get("tools", [])
                print(f"Loaded {len(existing_tools)} existing tools.")
        except Exception as e:
            print(f"Error reading existing registry: {e}")

    # Map by name for easier upsert checks
    tool_map = {t["name"]: t for t in existing_tools}

    # 2. Fetch and Parse
    for url in sources:
        print(f"Fetching {url}...")
        content = fetch_content(url)
        if content:
            found = parse_markdown_list(content)
            print(f"Found {len(found)} servers in {url}")
            for server in found:
                # Deduplicate: Only add if not already present (manual entries take precedence)
                # Cleaning up name: "mcp-server-foo" -> "foo" if desired, but sticking to raw name is safer for now.
                # Removing emojis if possible could be good, but not strictly necessary.
                if server["name"] not in tool_map:
                    tool_map[server["name"]] = server
                else:
                    # Update description if the new one is longer/better? For now, skip to preserve manual.
                    pass

    # 3. Save
    final_tools = list(tool_map.values())
    
    # Sort by name
    final_tools.sort(key=lambda x: x["name"].lower())

    output = {"tools": final_tools}
    
    try:
        with open(COMMUNITY_PATH, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)
        print(f"Saved {len(final_tools)} tools to {COMMUNITY_PATH}")
    except Exception as e:
        print(f"Error saving registry: {e}")

if __name__ == "__main__":
    main()
