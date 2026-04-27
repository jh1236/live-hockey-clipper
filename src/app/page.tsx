'use client';

import {Button, Flex, Stack, Text, TextInput, Title, Tooltip} from "@mantine/core";
import {redirect} from "next/navigation";
import {useEffect, useState} from "react";
import {useLocalStorage} from "react-use";
import {useMounted} from "@mantine/hooks";
import {GamesDisplay} from "@/components/GamesDisplay";
import {Game} from "@/database/database";

export default function Page() {
    const [gameBlob, setGameBlob] = useState<string>("");
    const [username] = useLocalStorage<string | null>("username", null);
    const [upcoming, setUpcoming] = useState<Game[] | null>(null)
    const [live, setLive] = useState<Game[] | null>(null)


    useEffect(() => {
        fetch("/api/game/recent")
            .then((it) => it.json())
            .then((it: { games: Game[], live: Game[], upcoming: Game[] }) => {
                setLive(it.live)
                setUpcoming(it.upcoming)
            });
    }, []);

    const mounted = useMounted()

    if (mounted && !username) {
        return <Flex h="100svh" w="100svw" justify="center" align="center" direction="column">
            <Text><i>To use this site, you must be logged into live hockey</i></Text>
            <Button bg="red" size="xl" w="80%" h="30%" m={30} onClick={() => redirect('/login')}>Login</Button>
        </Flex>
    }

    const gameBlobError = !/^[0-9a-zA-Z]*$/.test(gameBlob);


    return <Flex h="100svh" w="100svw" justify="center" align="center" direction="column" p={10} pt={20}>
        <Stack >
            <Title order={2} ta="center">Clip By Link</Title>
            <TextInput
                       description="Paste in the link to the game on LiveHockey"
                       value={gameBlob}
                       error={gameBlobError ? 'Game blob should only contain letters and numbers!' : undefined}
                       onChange={(e) => setGameBlob(e.target.value.replace(/.*\/game\//, ""))}/>
            <Tooltip label={<>
                {!gameBlob && <>You must provide a link to the game!<br/></>}
                {gameBlobError && <>Game blob should only contain letters and numbers!<br/></>}
            </>} disabled={!!gameBlob && !gameBlobError}>

                <Button bg="green"
                        data-disabled={!gameBlob || gameBlobError}
                        onClick={() => {
                            redirect(`/${gameBlob}`)
                        }}>
                    Begin
                </Button>
            </Tooltip>
        </Stack>
        <Flex direction="column" h="100%" w="100%" p={10} ta="center" style={{overflowX: 'hidden'}}>
            <Title order={2} p={20} >Ongoing Games</Title>
            <GamesDisplay games={live} missingMessage={"There are currently no ongoing games."}></GamesDisplay>
            <br />
            <Title order={2} p={20} >Upcoming Games</Title>
            <GamesDisplay games={upcoming} missingMessage={"There are currently no upcoming games."} createLink={() => '#'}></GamesDisplay>
            <br />
        </Flex>
    </Flex>

}