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
                
                # Fetch tech news using a broad search query
                print("Fetching global tech news...")
                result = await session.call_tool('convert_to_markdown', {
                    'uri': 'https://news.google.com/search?q=technology&hl=en-US&gl=US&ceid=US:en'
                })
                
                print("\n--- Latest Tech News Headlines ---\n")
                for content in result.content:
                    if hasattr(content, 'text'):
                        # Google News search results usually contain headlines and snippets
                        # We'll print a larger chunk to ensure we see the news
                        print(content.text[:8000])
                print("\n----------------------------------")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
