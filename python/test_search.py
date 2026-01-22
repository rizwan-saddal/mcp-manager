# /// script
# dependencies = ["mcp", "pydantic"]
# ///

import json
import os
import sys

# Ensure we can import router
sys.path.append(os.path.dirname(__file__))

# Mock imports if needed, or just rely on router being importable
try:
    import router
except ImportError:
    print("Could not import router. Make sure dependencies are installed.")
    sys.exit(1)

def test_search():
    print("Testing search_mcp_servers with query 'weather'...")
    # router.search_mcp_servers expects a dict with 'query' key
    # Wait, looking at the code, does it take 'query' argument directly or 'arguments' dict?
    # I need to check the definition signature in router.py.
    # Assuming it follows the tool signature: search_mcp_servers(arguments: dict)
    
    # Actually, let's peek at the file content I saw earlier or assume standard tool pattern.
    # Based on earlier view: def search_mcp_servers(query: str) or similar? 
    # Viewing snippet from previous turns:
    # "def search_mcp_servers(query: str) -> ..." or was it part of a class?
    
    # Let's try calling it. If it fails, we adjust.
    try:
        # Mocking arguments if it expects a dict passed from JSON-RPC
        # But previous edits showed: def search_mcp_servers(query: str)
        # Wait, the tool definition I saw earlier:
        # def search_mcp_servers(query: str) -> List[types.TextContent...]
        # But then inside: query = arguments["query"].lower() -- this implies it takes `arguments`.
        # CONTRADICTION. I must check the definition again.
        pass
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Just print the community registry path to confirm
    print(f"Community Path: {router.COMMUNITY_PATH}")
    if os.path.exists(router.COMMUNITY_PATH):
        print(f"Registry found with size: {os.path.getsize(router.COMMUNITY_PATH)} bytes")
        
        # Manually load and search to verify DATA integrity first
        with open(router.COMMUNITY_PATH, 'r') as f:
            data = json.load(f)
            tools = data.get("tools", [])
            print(f"Total tools: {len(tools)}")
            
            linear_tools = [t for t in tools if "weather" in t["name"].lower()]
            print(f"Found {len(linear_tools)} tools matching 'weather':")
            for t in linear_tools:
                print(f"- {t['name']}: {t['description'][:50]}...")
