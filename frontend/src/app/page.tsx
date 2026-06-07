'use client';

import {ActionIcon, Box, Button, Checkbox, Flex, Group, Popover, Stack, TextInput, Title, Tooltip} from "@mantine/core";
import {redirect} from "next/navigation";
import {useEffect, useState} from "react";
import {useLocalStorage} from "react-use";
import {GamesDisplay} from "@/components/GamesDisplay";
import {FaSlidersH} from "react-icons/fa";
import {Game, SERVER_ADDRESS} from "@/serverTypes";
import {FaFloppyDisk} from "react-icons/fa6";
import Link from "next/link";

export default function Page() {
    const [gameBlob, setGameBlob] = useState<string>("");
    const [error, setError] = useState<string | null>(null)
    const [upcoming, setUpcoming] = useState<Game[] | null>(null)
    const [recent, setRecent] = useState<Game[] | null>(null)
    const [premierOnly, setPremierOnly] = useLocalStorage<boolean>("premierOnly", true);
    const [includeMasters, setIncludeMasters] = useLocalStorage<boolean>("includeMasters", false);
    const [includeJuniors, setIncludeJuniors] = useLocalStorage<boolean>("includeJuniors", false);
    const [onlyClippable, setOnlyClippable] = useLocalStorage<boolean>("clippable", true);

    useEffect(() => {
        if (includeJuniors === undefined || premierOnly === undefined || includeMasters === undefined || onlyClippable === undefined) return;
        const url = new URL(`${SERVER_ADDRESS}/api/clips/games/recent`, window.location.origin);
        url.searchParams.append('location', 'hockeywa')
        url.searchParams.append('juniors', '' + includeJuniors)
        url.searchParams.append('premier', '' + premierOnly)
        url.searchParams.append('masters', '' + (!premierOnly && includeMasters))
        url.searchParams.append('clippable', '' + onlyClippable)
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
    }, [includeJuniors, includeMasters, onlyClippable, premierOnly]);


    const gameBlobError = !/^[0-9a-zA-Z]*$/.test(gameBlob);


    return <Flex h="100svh" w="100svw" justify="center" align="center" direction="column" p={10}>
        <Box h={0} w="100%" pos="relative">
            <Link href='/favourites'>
                <ActionIcon
                    right={0}
                    pos="absolute"
                    variant="subtle">
                    <FaFloppyDisk/>
                </ActionIcon>
            </Link>
        </Box>
        <Flex direction="column" align="center" h="100%" w="100%" ta="center" style={{overflowX: 'hidden'}}>
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
                                checked={includeMasters ?? false}
                                disabled={premierOnly}
                                indeterminate={premierOnly && includeMasters}
                                onChange={e => {
                                    setRecent(null)
                                    setUpcoming(null)
                                    setIncludeMasters(e.target.checked)
                                }}
                                label="Include Masters Fixtures?"></Checkbox>
                            <Checkbox
                                m={10}
                                checked={!premierOnly}
                                onChange={e => {
                                    setRecent(null)
                                    setUpcoming(null)
                                    setPremierOnly(!e.target.checked)
                                }}
                                label="Include Non Premier Fixtures?"></Checkbox>
                            <Checkbox
                                m={10}
                                checked={!onlyClippable}
                                onChange={e => {
                                    setRecent(null)
                                    setUpcoming(null)
                                    setOnlyClippable(!e.target.checked)
                                }}
                                label="Include Fixtures with no video?"></Checkbox>
                        </Popover.Dropdown>
                    </Popover>
                </Box>
            </Group>
            <GamesDisplay
                games={upcoming ?? null}
                createLink={it => it.liveHockeyId ? `/${it.identifier}` : '#'}
                missingMessage={"There are currently no upcoming games."}
                error={error}
            />
            <br/>
            <Title order={2} p={20}>Recent Games</Title>
            <GamesDisplay
                games={recent ?? null}
                createLink={it => it.liveHockeyId ? `/${it.identifier}` : '#'}
                missingMessage={"There are currently no recent games."}
                error={error}/>
            <br/>
        </Flex>
        <Stack my={10}>
            <Title order={4} ta="center">Clip By Link</Title>
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
                        size="compact-sm"
                        data-disabled={!gameBlob || gameBlobError}
                        onClick={() => {
                            fetch(`${SERVER_ADDRESS}/api/clips/games/blob/${gameBlob}`)
                                .then(it => it.json())
                                .then((it: { game: Game }) => {
                                    redirect(`/${it.game.id}`)
                                })
                        }}>
                    Begin
                </Button>
            </Tooltip>
        </Stack>
    </Flex>

}