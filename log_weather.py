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
        "activity": "Weather Forecast Search",
        "details": "Searched for 14-day Abu Dhabi weather forecast (Jan 22 - Feb 4, 2026) to fulfill user request."
    }
    await router.call_tool("log_activity", args)
    print("Action logged to usage.jsonl")

if __name__ == "__main__":
    asyncio.run(log())
