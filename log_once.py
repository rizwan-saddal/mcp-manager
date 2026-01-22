# /// script
# dependencies = ["mcp", "pydantic"]
# ///

import asyncio
import sys
import os

# Ensure we can import router
sys.path.append(os.path.join(os.path.dirname(__file__), "python"))
import router

async def log():
    args = {
        "activity": "Web Search",
        "details": "Searched for 'latest popular model context protocol servers 2026' to provide up-to-date info to user."
    }
    await router.call_tool("log_activity", args)
    print("Action logged.")

if __name__ == "__main__":
    asyncio.run(log())
