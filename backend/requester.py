import asyncio
import atexit

import httpx

# thank you whistle iq for sucking
client = httpx.AsyncClient(timeout=20)

# 
# def _close_hack():
#     loop = asyncio.get_event_loop()
#     loop.run_until_complete(client.aclose())
# 
# 
# atexit.register(_close_hack)
