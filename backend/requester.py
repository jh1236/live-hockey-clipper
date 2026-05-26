import asyncio
import atexit

import httpx

client = httpx.AsyncClient()

# 
# def _close_hack():
#     loop = asyncio.get_event_loop()
#     loop.run_until_complete(client.aclose())
# 
# 
# atexit.register(_close_hack)
