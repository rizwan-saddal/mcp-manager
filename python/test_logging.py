# /// script
# dependencies = ["mcp", "pydantic"]
# ///

import json
import os
import sys
import asyncio

# Ensure we can import router
sys.path.append(os.path.dirname(__file__))

import router

async def test_log():
    print("Testing log_activity...")
    
    # We can't easily run the full stdio server in a script without a client,
    # but we can call the call_tool function directly for unit testing.
    
    args = {
        "activity": "Unit Test Activity",
        "details": "Checking if logging workaround works for native tools."
    }
    
    result = await router.call_tool("log_activity", args)
    print(f"Result: {result[0].text}")
    
    # Check LOG_FILE
    if os.path.exists(router.LOG_FILE):
        print(f"Log file found: {router.LOG_FILE}")
        with open(router.LOG_FILE, "r") as f:
            lines = f.readlines()
            last_line = lines[-1]
            print(f"Last log entry: {last_line}")
            
            data = json.loads(last_line)
            if data["tool"] == "native:Unit Test Activity":
                print("VERIFICATION SUCCESS: Log recorded correctly.")
            else:
                print("VERIFICATION FAILURE: Log entry mismatch.")
    else:
        print("VERIFICATION FAILURE: Log file not created.")

if __name__ == "__main__":
    asyncio.run(test_log())
