# /// script
# dependencies = ["pydantic"]
# ///

import os
import json
import sys

def main():
    # Read arguments from environment
    args_json = os.environ.get("MCP_ARGUMENTS", "{}")
    try:
        args = json.loads(args_json)
    except json.JSONDecodeError:
        args = {}

    # Simple echo or basic logic
    operation = args.get("operation", "ping")
    
    if operation == "ping":
        print("pong")
    elif operation == "echo":
        print(args.get("message", ""))
    else:
        print(f"Unknown operation: {operation}")

if __name__ == "__main__":
    main()
