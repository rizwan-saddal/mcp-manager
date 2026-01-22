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

def parse_markdown_list(content, url):
    servers = []
    # Regex for "- [Name](URL) - Description" or similar
    # Captures: Name, URL, Description
    pattern = r'-\s+\[(.*?)\]\((.*?)\)\s*[-:]\s*(.*)'
    
    # Debug: Print first 10 lines
    print(f"--- START CONTENT PREVIEW {url} ---")
    for i, line in enumerate(content.splitlines()[:15]):
        print(f"{i}: {line}")
    print("--- END CONTENT PREVIEW ---")

    for line in content.splitlines():
        # Robust Regex: 
        # Find [Name](URL) followed closely by " - " or " : "
        # This handles "- **[Name](URL)** - Desc" and other variations.
        
        match = re.search(r'\[(.*?)\]\((.*?)\).{0,5}[-:]\s*(.*)', line)
        
        if match:
            # Check if it looks like a server entry (has a description, not just a navigation link)
            name = match.group(1).strip()
            url_match = match.group(2).strip()
            description = match.group(3).strip()
            
            if not description:
                continue

            # Cleanup name if it's bolded inside the brackets (unlikely for proper markdown, but possible)
            # Usually **[Name]** means the boolean is outside.
            # If the regex matched `[**Name**](...)`, we'd see `**Name**`.
            if name.startswith("**") and name.endswith("**"):
                name = name[2:-2]

            # Filtering heuristics
            if "mcp" in name.lower() or "server" in name.lower() or "mcp" in description.lower() or "server" in url_match.lower():
                 servers.append({
                    "name": name,
                    "url": url_match,
                    "description": description,
                    "command": [], 
                    "inputSchema": {} 
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
            found = parse_markdown_list(content, url)
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
