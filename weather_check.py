# /// script
# dependencies = ["mcp", "markitdown-mcp"]
# ///

import asyncio
import json
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.session import ClientSession

async def main():
    server_params = StdioServerParameters(
        command='markitdown-mcp',
        args=[],
        env={}
    )
    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                # Using the URL from search result
                result = await session.call_tool('convert_to_markdown', {'uri': 'https://www.google.com/search?q=weather+in+Abu+Dhabi'})
                
                print("Weather Page Summary:")
                for content in result.content:
                    if hasattr(content, 'text'):
                        print(content.text[:500] + "...") # First 500 chars
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
