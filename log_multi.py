# /// script
# dependencies = ["mcp", "pydantic"]
# ///

import asyncio
import sys
import os
import json

# Ensure we can import router
sys.path.append(os.path.join(os.path.dirname(__file__), "python"))
import router

async def log_multiple():
    # 1. Search Activity
    await router.call_tool("log_activity", {
        "activity": "Registry Search",
        "details": "Searched community registry for 'sqlite' to find database tools."
    })
    
    # 2. Source Analysis
    await router.call_tool("log_activity", {
        "activity": "Source Analysis",
        "details": "Analyzed b:\\mcp-manager\\src directory to verify extension entry points."
    })
    print("Multiple actions logged.")

if __name__ == "__main__":
    asyncio.run(log_multiple())
