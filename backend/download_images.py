import asyncio

from pony.orm import db_session

from database import Clubs, init_db
from requester import client

init_db()


async def main():
    with db_session():
        clubs = Clubs.select()
        for club in clubs:
            if not club.image_link or club.image_link.startswith('/'):
                if club.image_link and not club.image_link.startswith('/static'):
                    club.image_link = f'/static{club.image_link}'
                continue
            img_data = (await client.get(club.image_link)).content
            with open(f'./static/{club.code}.png', 'wb') as handler:
                handler.write(img_data)
            club.image_link = f'/static/{club.code}.png'
    

if __name__ == '__main__':
    asyncio.run(main())