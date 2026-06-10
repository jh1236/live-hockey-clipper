'use client';

import {
    ActionIcon,
    Box,
    Button,
    Checkbox,
    Flex,
    Group,
    MultiSelect,
    Popover, Select,
    Stack,
    TextInput,
    Title,
    Tooltip
} from "@mantine/core";
import {redirect} from "next/navigation";
import {useEffect, useState} from "react";
import {useEffectOnce} from "react-use";
import {GamesDisplay} from "@/components/GamesDisplay";
import {FaSlidersH} from "react-icons/fa";
import {Game, Official, SERVER_ADDRESS, Team, Venue} from "@/serverTypes";
import {FaFloppyDisk} from "react-icons/fa6";
import Link from "next/link";
import {useStorageBackedValue} from "@/components/hooks";

export default function Page() {
    const [gameBlob, setGameBlob] = useState<string>("");
    const [error, setError] = useState<string | null>(null)
    const [upcoming, setUpcoming] = useState<Game[] | null>(null)
    const [recent, setRecent] = useState<Game[] | null>(null)
    const premierOnly = useStorageBackedValue<boolean>("premierOnly", true);
    const includeMasters = useStorageBackedValue<boolean>("includeMasters", false);
    const includeJuniors = useStorageBackedValue<boolean>("includeJuniors", false);
    const [allVenues, setAllVenues] = useState<Venue[]>([]);
    const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
    const [allUmpires, setAllUmpires] = useState<Official[]>([]);
    const [selectedUmpires, setselectedUmpires] = useState<string[]>([]);
    const onlyClippable = useStorageBackedValue<boolean>("clippable", true);

    useEffect(() => {
        fetch(`${SERVER_ADDRESS}/api/appointments/umpires`)
            .then(it => it.json())
            .then(it => setAllUmpires(it.umpires))

        fetch(`${SERVER_ADDRESS}/api/appointments/venues`)
            .then(it => it.json())
            .then(it => setAllVenues(it.venues))

        fetch(`${SERVER_ADDRESS}/api/teams/`)
            .then(it => it.json())
            .then(it => setAllTeams(Object.values(it)))
    }, []);

    useEffectOnce(() => {
        const url = new URL(`${SERVER_ADDRESS}/api/games/recent`, window.location.origin);
        url.searchParams.append('location', 'hockeywa')
        url.searchParams.append('juniors', '' + includeJuniors.value)
        url.searchParams.append('premier', '' + premierOnly.value)
        url.searchParams.append('masters', '' + (!premierOnly.value && includeMasters.value))
        url.searchParams.append('clippable', '' + onlyClippable.value)
        for (const u of selectedUmpires) {
            url.searchParams.append('umpire', u)
        }
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
    });


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
                                checked={includeJuniors.value}
                                onChange={e => {
                                    includeJuniors.setValue(e.target.checked)
                                }}
                                label="Include Junior Fixtures?"></Checkbox>
                            <Checkbox
                                m={10}
                                checked={includeMasters.value}
                                disabled={premierOnly.value}
                                indeterminate={premierOnly.value && includeMasters.value}
                                onChange={e => {
                                    includeMasters.setValue(e.target.checked)
                                }}
                                label="Include Masters Fixtures?"></Checkbox>
                            <Checkbox
                                m={10}
                                checked={!premierOnly.value}
                                onChange={e => {
                                    premierOnly.setValue(!e.target.checked)
                                }}
                                label="Include Non Premier Fixtures?"></Checkbox>
                            <Checkbox
                                m={10}
                                checked={!onlyClippable.value}
                                onChange={e => {
                                    onlyClippable.setValue(!e.target.checked)
                                }}
                                label="Include Fixtures with no video?"></Checkbox>
                            <MultiSelect comboboxProps={{withinPortal: false}} label="With Umpires" searchable
                                         value={selectedUmpires}
                                         onChange={setselectedUmpires}
                                         maxValues={2}
                                         data={allUmpires.map(it => it.name).sort()}></MultiSelect>
                            <Select comboboxProps={{withinPortal: false}} label="With Venue" searchable
                                    value={selectedVenue}
                                    onChange={e => setSelectedVenue(e)}
                                    data={allVenues.filter(it => it.hasVideo || !onlyClippable.value).map(it => it.shortName).sort()}></Select>
                            <MultiSelect comboboxProps={{withinPortal: false}} label="With Teams" searchable
                                         value={selectedTeams}
                                         onChange={setSelectedTeams}
                                         maxValues={2}
                                         data={allTeams.map(it => it.code).sort()}></MultiSelect>
                            <Group mt={10} w="100%" justify="space-around">
                                <Button
                                    color="gray"
                                    onClick={() => {
                                        includeJuniors.resetValue()
                                        includeMasters.resetValue()
                                        premierOnly.resetValue()
                                        onlyClippable.resetValue()
                                    }}>Reset</Button>
                                <Button
                                    color="green"
                                    onClick={() => {
                                        setRecent(null)
                                        setUpcoming(null)
                                        includeJuniors.saveValue()
                                        includeMasters.saveValue()
                                        premierOnly.saveValue()
                                        onlyClippable.saveValue()
                                        const url = new URL(`${SERVER_ADDRESS}/api/games/recent`);
                                        url.searchParams.append('location', 'hockeywa')
                                        url.searchParams.append('juniors', '' + includeJuniors.value)
                                        url.searchParams.append('premier', '' + premierOnly.value)
                                        url.searchParams.append('masters', '' + (!premierOnly.value && includeMasters.value))
                                        url.searchParams.append('clippable', '' + onlyClippable.value)
                                        for (const u of selectedUmpires) {
                                            url.searchParams.append('umpire', u)
                                        }
                                        if (selectedVenue !== null) {
                                            url.searchParams.append('venue', selectedVenue)
                                        }
                                        for (const t of selectedTeams) {
                                            url.searchParams.append('team', t)
                                        }
                                        fetch(url)
                                            .then((it) => it.json())
                                            .then((it: { recent: Game[], upcoming: Game[] }) => {
                                                setRecent(it.recent)
                                                setUpcoming(it.upcoming)
                                                setError(null)
                                            }).catch((err) => {
                                            setError(err.toString())
                                        });
                                    }}>Apply</Button>
                            </Group>
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
                            fetch(`${SERVER_ADDRESS}/api/games/blob/${gameBlob}`)
                                .then(it => it.json())
                                .then((it: { game: Game }) => {
                                    redirect(`/${it.game.identifier}`)
                                })
                        }}>
                    Begin
                </Button>
            </Tooltip>
        </Stack>
    </Flex>

}