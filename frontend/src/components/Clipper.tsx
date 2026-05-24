"use client";

import {useEffect, useState} from "react";
import {useBoolean, useCopyToClipboard, useInterval, useLocalStorage, useMountedState} from "react-use";
import {
    ActionIcon,
    Box,
    Button,
    Center,
    Flex,
    Grid,
    Group,
    HoverCard,
    Input,
    Modal,
    Popover,
    Skeleton,
    Slider,
    Stack,
    Text,
    TextInput,
    Tooltip
} from "@mantine/core";
import {hmsToSecondsOnly, secondsToHMS} from "@/utils";
import {Clip, ClipGame, SERVER_ADDRESS} from "@/serverTypes";
import Link from "next/link";
import Image from "next/image";
import {FaArrowUpRightFromSquare} from "react-icons/fa6";
import {ClipsDisplay} from "@/components/ClipsDisplay";

interface ClipperProps {
    blob: string;
}


const MINUTE_IN_MS = 1000 * 60
const PRIOR_CLIP_RECORDING = 10;


export function Clipper({blob: gameBlob}: ClipperProps) {
    const mounted = useMountedState();
    const [game, setGame] = useState<ClipGame | null>(null)
    const [clips, setClips] = useState<(Clip | undefined)[] | null>(null);
    const [openAddClips, setOpenAddClips] = useBoolean(false);
    const [durationToClip, setDurationToClip] = useState<number>(10);
    const [timeToClip, setTimeToClip] = useState<string>('00:00:00');
    const [clipQuality, setClipQuality] = useState<number>(4);
    const [currentTime, setCurrentTime] = useState<number>(-1);
    const [username] = useLocalStorage<string | null>("username", null);
    const [password] = useLocalStorage<string | null>("password", null);

    const [state, copyToClip] = useCopyToClipboard()
    const [copyTime, setCopyTime] = useState<number>(-1);

    useEffect(() => {
        setCurrentTime(Date.now());
    }, [])

    useInterval(
        () => {
            if (game && currentTime + 5 * MINUTE_IN_MS < game.startTime && Date.now() + 5 * MINUTE_IN_MS > game.startTime && !game.isLive) {
                // if the game starts in 5 minutes, and the game isn't live, we should check the server and update our game
                // (there should be no race condition as all games start broadcast 15 mins before the true start time)
                fetch(`${SERVER_ADDRESS}/api/clips/games/${gameBlob}`).then(it => it.json()).then((it: {
                    game: ClipGame,
                    clips: Clip[]
                }) => {
                    setGame(it.game)
                    setClips(it.clips)
                })
            }
            setCurrentTime(Date.now());
        },
        (game?.startTime ?? 0) > 0 ? 500 : null
    )

    useEffect(() => {
        if (gameBlob) {
            console.log("Requesting!")
            fetch(`${SERVER_ADDRESS}/api/clips/games/${gameBlob}`).then(it => it.json()).then((it: {
                game: ClipGame,
                clips: Clip[]
            }) => {
                setGame(it.game)
                setClips(it.clips)
            })
        }
    }, [gameBlob]);


    if (!game || !clips) {
        return <Flex h="100svh" w="100svw" justify="space-around" align="center" direction="column">
            {/*<Text ta="center" fz="2.5em">{game.competitionName.replace(/^WA /, '').replace(/-/, '')}</Text>*/}

            <Center>
                <Grid p={20} gap={0} w="100%">
                    <Grid.Col span={12}><Skeleton height={20} w="100%" mb={12}/></Grid.Col>
                    <Grid.Col span={5} w={150}>
                        <Skeleton h={110} w={110} circle radius="xl"/>
                    </Grid.Col>
                    <Grid.Col span={2}>

                    </Grid.Col>
                    <Grid.Col span={5} w={150}>
                        <Skeleton h={110} w={110} circle radius="xl"/>
                    </Grid.Col>
                </Grid>
            </Center>
            <Button size="xl" w="60%" m={10} disabled>Add Clip</Button>
            <ClipsDisplay clips={null} setClips={() => {
            }} noClipMessage={''}/>
            <Group w="70%" justify="space-between">
                <Popover>
                    <Popover.Target>
                        <Button bg="red" p={10} m={20} size="lg">Back</Button>
                    </Popover.Target>
                    <Popover.Dropdown>
                        <Stack align="center">
                            <Text>Are you sure you want to Leave?</Text>
                            <Link href="/">
                                <Button bg="red">Yes</Button>
                            </Link>
                        </Stack>
                    </Popover.Dropdown>
                </Popover>

                <Button bg="green" p={10} m={20} size="lg" disabled>Share</Button>

            </Group>
        </Flex>
    }

    const timeToClipError = !/^(\d?\d)(:\d\d)?(:\d\d)?$/.test(timeToClip) || game.startTime + hmsToSecondsOnly(timeToClip) > Date.now();
    const unnamedCount = clips.filter(it => /^Unsaved Clip \d+$/.test(it?.name ?? '')).map(i => +i!.name.replace('Unsaved Clip', '')).reduce((a, b) => Math.max(a, b), 0) + 1

    return <Box>
        <Modal opened={openAddClips} onClose={() => setOpenAddClips(false)} title="Add Clip" centered>
            <Box ml={10} mr={10} style={{overflow: 'hidden'}}>
                <TextInput
                    mt={10}
                    mb={10}
                    withAsterisk
                    label="Clip Start"
                    description={`Defaults to ${PRIOR_CLIP_RECORDING} seconds before the button was pressed`}
                    value={timeToClip}
                    placeholder="--:--:--"
                    error={timeToClipError ? 'Malformed Timestamp!' : undefined}
                    onChange={e => setTimeToClip(e.target.value)}/>
                <Input.Wrapper label="Clip Duration" description='The minimum length of the clip' withAsterisk>
                    <Center mb={30} mt={5}>
                        <Slider
                            w="70%"
                            label={it => `${it} seconds`}
                            min={10}
                            max={30}
                            marks={[
                                {value: 10, label: '10 Seconds'}, {value: 30, label: '30 Seconds'}
                            ]}
                            value={durationToClip}
                            onChange={setDurationToClip}
                        />
                    </Center>
                </Input.Wrapper>
                <Input.Wrapper label="Clip Quality" withAsterisk>
                    <Center mb={30} mt={5}>
                        <Slider
                            w="70%"
                            label={it => {
                                switch (it) {
                                    case 10:
                                        return 'High'
                                    case 5:
                                        return 'Balanced'
                                    case 0:
                                        return 'Low'
                                    default:
                                        return it
                                }
                            }}
                            marks={[
                                {value: 0, label: 'Quicker Download'},
                                {value: 5, label: 'Balanced'},
                                {value: 10, label: 'Higher Quality'},
                            ]}
                            min={0}
                            max={10}
                            value={clipQuality}
                            onChange={setClipQuality}
                        />
                    </Center>
                </Input.Wrapper>
                <Center>
                    <Box mt={25}>
                        <Tooltip label={<>
                            {timeToClipError && <>The Clip Start timestamp ({timeToClip}) is not valid!<br/></>}
                        </>} disabled={!timeToClipError}>
                            <Button bg="green"
                                    disabled={timeToClipError}
                                    onClick={() => {
                                        const newClip: Omit<Clip, 'link'> = {
                                            name: `Unsaved Clip ${unnamedCount}`,
                                            timecode: timeToClip,
                                            length: secondsToHMS(durationToClip),
                                            gameBlob
                                        };
                                        setClips([...clips!, undefined])
                                        fetch(`${SERVER_ADDRESS}/api/clips/add`, {
                                            method: "POST",
                                            headers: {
                                                'Content-Type': "application/json",
                                            },
                                            body: JSON.stringify({
                                                gameBlob,
                                                clip: newClip,
                                                quality: clipQuality,
                                                username,
                                                password,
                                            })
                                        }).then(it => it.json()).then(({clip}) => {
                                            setClips(prev => prev!.map((it, i, arr) => arr.indexOf(undefined) === i ? clip : it))
                                        }).catch(() => {
                                            setClips(prev => prev!.filter((_, i, arr) => arr.indexOf(undefined) !== i))
                                        })
                                        setOpenAddClips(false)
                                    }}>Save Clip</Button>
                        </Tooltip>
                    </Box>
                </Center>
            </Box>
        </Modal>

        <Flex h="100svh" w="100svw" justify="space-around" align="center" direction="column">
            {/*<Text ta="center" fz="2.5em">{game.competitionName.replace(/^WA /, '').replace(/-/, '')}</Text>*/}
            <Center>
                <Grid p={20} gap={0}>
                    <Grid.Col span={5}><Text ta="center" fz="2em">{game.teamOne}</Text></Grid.Col>
                    <Grid.Col span={2}>
                        <Popover>
                            <Popover.Target>
                                <Text ta="center" fz="2em">VS</Text>
                            </Popover.Target>
                            <Popover.Dropdown>
                                <Button onClick={() => {
                                    setClips(prev => prev?.map(() => undefined) ?? null)
                                    fetch(`${SERVER_ADDRESS}/api/clips/regenerate`, {
                                        method: "POST",
                                        headers: {
                                            'Content-Type': "application/json",
                                        },
                                        body: JSON.stringify({
                                            gameBlob,
                                            quality: clipQuality,
                                            username,
                                            password,
                                        })
                                    }).then(it => it.json()).then(({clips}) => {
                                        setClips(clips)
                                    }).catch(() => fetch(`${SERVER_ADDRESS}/api/clips/games/${gameBlob}`).then(it => it.json()).then((it: {
                                        clips: Clip[]
                                    }) => {
                                        setClips(it.clips)
                                    }))
                                }}>Regenerate All Clips?</Button>
                            </Popover.Dropdown>
                        </Popover>
                    </Grid.Col>
                    <Grid.Col span={5}><Text ta="center" fz="2em">{game.teamTwo}</Text></Grid.Col>
                    <Grid.Col span={5}>
                        <Center>
                            <Image src={game.teamOneImage} alt="Home team image" width={110} height={110}/>
                        </Center>
                    </Grid.Col>
                    <Grid.Col span={2}>

                        <Stack h="100%" align="center" justify="center">
                            {game.isLive && <Text ta="center">
                                {secondsToHMS(Math.round((currentTime - game.startTime) / 1000))}
                            </Text>}
                            <Popover>
                                <Popover.Target>
                                    <ActionIcon variant="subtle"><FaArrowUpRightFromSquare/></ActionIcon>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Stack align="center">
                                        <Link
                                            href={game.altiusLink ?? game.teamstarLink ?? '#'}
                                            target={game.altiusLink || game.teamstarLink ? '_blank' : undefined}
                                        >
                                            <Button>
                                                View on {game.altiusLink ? 'Altius' : 'Teamstar'}
                                            </Button>
                                        </Link>
                                        <Link
                                            href={`https://www.livehockey.com.au/en/game/${gameBlob}`}
                                            target="_blank"
                                        >
                                            <Button>
                                                View on Live Hockey
                                            </Button>
                                        </Link>
                                    </Stack>
                                </Popover.Dropdown>

                            </Popover>

                        </Stack>

                    </Grid.Col>
                    <Grid.Col span={5}>
                        <Center>
                            <Image src={game.teamTwoImage} alt="Away team image" width={110} height={110}/>
                        </Center>
                    </Grid.Col>
                </Grid>
            </Center>
            {!!game.officials.length &&
                <Group><Text fw={600}>Officials:</Text> <Text fs="italic">{game.officials.join(', ')}</Text></Group>}
            <HoverCard disabled={game.isLive || game.startTime <= currentTime}>
                <HoverCard.Target>
                    <Button size="xl" w="60%" m={10} onClick={() => {
                        if (!game.isLive && game.startTime > currentTime) {
                            return
                        }
                        setTimeToClip(
                            game.isLive ?
                                secondsToHMS(Math.max(Math.round((currentTime - game?.startTime) / 1000) - PRIOR_CLIP_RECORDING, 0)) : '00:00:00'
                        );
                        setClipQuality(5)
                        setDurationToClip(PRIOR_CLIP_RECORDING);
                        setOpenAddClips(true);
                    }}
                            data-disabled={!game.isLive && game.startTime > currentTime}
                    >Add Clip</Button>
                </HoverCard.Target>
                <HoverCard.Dropdown>
                    The livestream has not started!
                </HoverCard.Dropdown>
            </HoverCard>
            <ClipsDisplay clips={clips} setClips={setClips} noClipMessage={
                <>There are no clips recorded for this game. <br/> Add one by
                    pressing &apos;Add Clip&apos; above!
                </>}/>
            <Group w="70%" justify="space-between">
                <Popover>
                    <Popover.Target>
                        <Button bg="red" p={10} m={20} size="lg">Back</Button>
                    </Popover.Target>
                    <Popover.Dropdown>
                        <Stack align="center">
                            <Text>Are you sure you want to Leave?</Text>
                            <Link href="/">
                                <Button bg="red">Yes</Button>
                            </Link>
                        </Stack>
                    </Popover.Dropdown>
                </Popover>

                <Popover opened={copyTime + 1000 > currentTime}>
                    <Popover.Target>
                        <Button bg="green" p={10} m={20} size="lg" onClick={() => {
                            setCopyTime(Date.now())
                            if (mounted()) {
                                copyToClip(window.location.href)
                            }
                        }}>Share</Button>
                    </Popover.Target>
                    <Popover.Dropdown>
                        <Text c={state.value === undefined ? 'red' : 'green'}
                              fw={600}>{state.value === undefined ? `Copy failed: ${state.error}` : 'Link Copied!'}</Text>
                    </Popover.Dropdown>
                </Popover>


            </Group>
        </Flex>
    </Box>
        ;
}
