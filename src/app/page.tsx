'use client';

import {ActionIcon, Box, Button, Checkbox, Flex, Group, Popover, Stack, TextInput, Title, Tooltip} from "@mantine/core";
import {redirect} from "next/navigation";
import {useEffect, useState} from "react";
import {useLocalStorage} from "react-use";
import {GamesDisplay} from "@/components/GamesDisplay";
import {Game} from "@/database/database";
import {FaSlidersH} from "react-icons/fa";

export default function Page() {
    const [gameBlob, setGameBlob] = useState<string>("");
    const [error, setError] = useState<string | null>(null)
    const [upcoming, setUpcoming] = useState<Game[] | null>(null)
    const [recent, setRecent] = useState<Game[] | null>(null)
    const [premierOnly, setPremierOnly] = useLocalStorage<boolean>("premierOnly", true);
    const [includeJuniors, setIncludeJuniors] = useLocalStorage<boolean>("includeJuniors", false);

    useEffect(() => {
        if (includeJuniors === undefined || premierOnly === undefined) return;
        const url = new URL('/api/game/recent', window.location.origin);
        url.searchParams.append('location', 'hockeywa')
        url.searchParams.append('juniors', '' + includeJuniors)
        url.searchParams.append('premier', '' + premierOnly)
        let cancelled = false
        fetch(url)
            .then((it) => it.json())
            .then((it: { recent: Game[], upcoming: Game[] }) => {
                if (cancelled) return
                setRecent(it.recent)
                setUpcoming(it.upcoming)
                setError(null)
            }).catch((err) => {
            setError(err.toString())
        });
        return () => {
            cancelled = true
        }
    }, [includeJuniors, premierOnly]);


    const gameBlobError = !/^[0-9a-zA-Z]*$/.test(gameBlob);


    return <Flex h="100svh" w="100svw" justify="center" align="center" direction="column" p={10} pt={20}>
        <Stack>
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
        <Flex direction="column" align="center" h="100%" w="100%" p={10} ta="center" style={{overflowX: 'hidden'}}>
            <Group p={20}>
                <Box w={40}></Box>
                <Title order={2}>Upcoming Games</Title>
                <Box w={40} ml={-10}>
                    <Popover>
                        <Popover.Target>
                            <ActionIcon variant="subtle"><FaSlidersH/></ActionIcon>
                        </Popover.Target>
                        <Popover.Dropdown>
                            <Checkbox
                                m={10}
                                checked={includeJuniors ?? false}
                                onChange={e => {
                                    setRecent(null)
                                    setUpcoming(null)
                                    setIncludeJuniors(e.target.checked)
                                }}
                                label="Include Junior Fixtures?"></Checkbox>
                            <Checkbox
                                m={10}
                                checked={!premierOnly}
                                onChange={e => {
                                    setRecent(null)
                                    setUpcoming(null)
                                    setPremierOnly(!e.target.checked)
                                }}
                                label="Include Non Premier Fixtures?"></Checkbox>
                        </Popover.Dropdown>
                    </Popover>
                </Box>
            </Group>
            <GamesDisplay
                games={upcoming?.filter(it => includeJuniors ? true : !it.competitionName.includes('Junior ')) ?? null}
                missingMessage={"There are currently no upcoming games."}
                createLink={it => it.isLive ? `/${it.blob}` : '#'}
                error={error}
            />
            <br/>
            <Title order={2} p={20}>Recent Games</Title>
            <GamesDisplay
                games={recent?.filter(it => includeJuniors ? true : !it.competitionName.includes('Junior ')) ?? null}
                missingMessage={"There are currently no recent games."}
                error={error}/>
            <br/>
        </Flex>
    </Flex>

}