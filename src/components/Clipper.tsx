"use client";

import {useEffect, useState} from "react";
import {useBoolean, useCopyToClipboard, useInterval, useLocalStorage} from "react-use";
import {
    ActionIcon,
    AspectRatio,
    Box,
    Button,
    Card,
    Center,
    Flex,
    Grid,
    Group,
    Loader,
    Modal,
    Paper,
    Popover,
    Skeleton,
    Slider,
    Stack,
    Text,
    TextInput,
    Tooltip
} from "@mantine/core";
import {hmsToSecondsOnly, secondsToHMS} from "@/utils";
import {FaFileDownload} from "react-icons/fa";
import {Clip} from "@/LiveHockeyManager";
import {Game} from "@/database/database";
import Link from "next/link";
import Image from "next/image";
import {FaArrowUpRightFromSquare} from "react-icons/fa6";
import {usePathname} from "next/navigation";

interface ClipperProps {
    blob: string;
}

// the max length a game can be considered going for is 2 hours and 15 minutes (completely arbitrary)
// const MAX_GAME_LENGTH = (2 * 60 + 15) * 60 * 60 * 1000;

const PRIOR_CLIP_RECORDING = 10;


export function Clipper({blob: gameBlob}: ClipperProps) {
    const [game, setGame] = useState<Game | null>(null)
    const [clips, setClips] = useState<Clip[] | null>(null);
    const [openAddClips, setOpenAddClips] = useBoolean(false);
    const [commentForNewClip, setCommentForNewClip] = useState<string>("");
    const [nameOfNewClip, setNameOfNewClip] = useState<string>("Clip 1");
    const [durationToClip, setDurationToClip] = useState<string>('00:00:00');
    const [timeToClip, setTimeToClip] = useState<string>('00:00:00');
    const [clipQuality, setClipQuality] = useState<number>(4);
    const [currentTime, setCurrentTime] = useState<number>(-1);
    const [editIndex, setEditIndex] = useState<number>(-1);
    const [username] = useLocalStorage<string | null>("username", null);
    const [password] = useLocalStorage<string | null>("password", null);

    const pathname = usePathname();
    const [state, copyToClip] = useCopyToClipboard()
    const [copyTime, setCopyTime] = useState<number>(-1);

    useInterval(
        () => {
            setCurrentTime(Date.now());
        },
        (game?.startTime ?? 0) > 0 ? 500 : null
    )

    useEffect(() => {
        if (gameBlob) {
            console.log("Requesting!")
            fetch('/api/game', {
                method: "POST", body: JSON.stringify({
                    gameBlob,
                    username,
                    password,
                })
            }).then(it => it.json()).then((it: { game: Game, clips: Clip[] }) => {
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
            <Grid flex={3} w="100%" p={20} overflow="scroll">
                {Array.from({length: 5}).map((_, i) => <Grid.Col key={i} span={{
                    base: 6,
                    md: 3
                }}>
                    <Card shadow="sm" padding="lg" withBorder>
                        <Card.Section p={10}>
                            <Center>
                                <Skeleton height={12} w="80%"/>
                            </Center>
                        </Card.Section>
                        <Card.Section mb={10}>
                            <AspectRatio ratio={16 / 9} maw={400} mx="auto" pos="relative" bg="#222222">
                                <Skeleton w="100%" h="100%" radius="sm"></Skeleton>
                            </AspectRatio>
                        </Card.Section>

                        <Skeleton height={12} w="20%" mb={6}/>
                        <Skeleton height={8} w="80%" mb={12}/>
                        <Skeleton height={12} w="20%" mb={6}/>
                        <Skeleton height={8} w="80%"/>


                        <Group w="100%" justify="space-around">
                            <ActionIcon disabled hiddenFrom="md" size="lg" color="blue" mt="md">
                                <FaArrowUpRightFromSquare/>
                            </ActionIcon>
                            <Button disabled visibleFrom="md" color="blue" mt="md">
                                Open in new tab
                            </Button>
                            <ActionIcon disabled hiddenFrom="md" size="lg" color="blue" mt="md">
                                <FaFileDownload/>
                            </ActionIcon>
                            <Button disabled visibleFrom="md" color="blue" mt="md">
                                Download
                            </Button>
                        </Group>

                    </Card>
                </Grid.Col>)}
            </Grid>
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

    const durationError = !/^(\d?\d)(:\d\d)?(:\d\d)?$/.test(durationToClip) || game.startTime + hmsToSecondsOnly(durationToClip) + hmsToSecondsOnly(timeToClip) > Date.now();
    const clipNameError = !nameOfNewClip || (clips?.filter((_, i) => i !== editIndex)?.map(it => it.name).includes(nameOfNewClip));
    const timeToClipError = !/^(\d?\d)(:\d\d)?(:\d\d)?$/.test(timeToClip) || game.startTime + hmsToSecondsOnly(timeToClip) > Date.now();

    return <Box>
        <Modal opened={openAddClips} onClose={() => setOpenAddClips(false)} title="Add Clip" centered>
            <Box ml={10} mr={10} style={{overflow: 'hidden'}}>
                <TextInput
                    mb={10}
                    label="Clip title"
                    description="File name for this clip"
                    error={!nameOfNewClip ?
                        "You must provide a name for the clip! " :
                        clipNameError ? `The name '${nameOfNewClip}' is already in use!` : undefined}
                    value={nameOfNewClip}
                    onChange={e => setNameOfNewClip(e.target.value)}/>
                <TextInput
                    mt={10}
                    mb={10}
                    label="Clip Comments"
                    description="Details about the clip"
                    placeholder="Your comment here"
                    value={commentForNewClip}
                    onChange={e => setCommentForNewClip(e.target.value)}/>
                <TextInput
                    mt={10}
                    mb={10}
                    label="Clip Start"
                    description={`Defaults to ${PRIOR_CLIP_RECORDING} seconds before the button was pressed`}
                    value={timeToClip}
                    placeholder="--:--:--"
                    error={timeToClipError ? 'Malformed Timestamp!' : undefined}
                    onChange={e => setTimeToClip(e.target.value)}/>
                <TextInput
                    mt={10}
                    mb={10}
                    label="Clip Duration"
                    description="How long the clip will record for"
                    placeholder="--:--:--"
                    value={durationToClip}
                    error={durationError ? 'Malformed Timestamp!' : undefined}
                    onChange={e => setDurationToClip(e.target.value)}/>
                <Text mt={10} fz="sm" fw={600}>Clip Quality</Text>
                <Center mt={10} mb={10}>
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
                <Center>
                    <Box mt={25}>
                        <Tooltip label={<>
                            {!nameOfNewClip ?
                                <>You must provide a name for the clip!<br/></> :
                                clipNameError && <>The name &apos;{nameOfNewClip}&apos; is already in use!<br/></>}
                            {timeToClipError && <>The Clip Start timestamp ({timeToClip}) is not valid!<br/></>}
                            {durationError && <>The Duration timestamp ({timeToClip}) is not valid!<br/></>}
                        </>} disabled={!durationError && !timeToClipError && !clipNameError}>
                            <Button bg="green"
                                    disabled={durationError || timeToClipError || clipNameError}
                                    onClick={() => {
                                        const newClip = {
                                            name: nameOfNewClip!,
                                            timecode: timeToClip,
                                            length: durationToClip,
                                            comment: commentForNewClip,
                                        };
                                        setClips([...clips!, newClip])
                                        fetch('/api/clip/add', {
                                            method: "POST",
                                            body: JSON.stringify({
                                                gameBlob,
                                                clip: newClip,
                                                quality: clipQuality
                                            })

                                        }).then(it => it.json()).then(({clip}) => {
                                            setClips(prev => prev!.map((it, idx) => it.name === clip.name ? clip : it))
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
                    <Grid.Col span={2}><Text ta="center" fz="2em">VS</Text></Grid.Col>
                    <Grid.Col span={5}><Text ta="center" fz="2em">{game.teamTwo}</Text></Grid.Col>
                    <Grid.Col span={5}>
                        <Center>
                            <Image src={game.teamOneImage} alt="Home team image" width={110} height={110}/>
                        </Center>
                    </Grid.Col>
                    <Grid.Col span={2}>
                        <Center h="100%">
                            {game.isLive && <Text ta="center">
                                {secondsToHMS(Math.round((currentTime - game.startTime) / 1000))}
                            </Text>}
                        </Center>
                    </Grid.Col>
                    <Grid.Col span={5}>
                        <Center>
                            <Image src={game.teamTwoImage} alt="Away team image" width={110} height={110}/>
                        </Center>
                    </Grid.Col>
                </Grid>
            </Center>
            <Button size="xl" w="60%" m={10} onClick={() => {
                setTimeToClip(
                    game.isLive ?
                        secondsToHMS(Math.max(Math.round((currentTime - game?.startTime) / 1000) - PRIOR_CLIP_RECORDING, 0)) : '00:00:00'
                );
                setClipQuality(5)
                setDurationToClip(secondsToHMS(PRIOR_CLIP_RECORDING, false));
                setNameOfNewClip(`Clip ${clips?.length ?? 1}`)
                setEditIndex(-1)
                setOpenAddClips(true);
            }}>Add Clip</Button>
            {clips.length ? <Grid flex={3} w="100%" h="80%" p={20} overflow="scroll">
                {clips.map((it) => <Grid.Col key={it.name + !!it.link} span={{
                    base: 6,
                    md: 3
                }}>
                    <Card shadow="sm" padding="lg" withBorder>
                        <Card.Section p={10}>
                            <Center>
                                <Text fz="1.1em" fw={600}>{it.name}</Text>
                            </Center>
                        </Card.Section>
                        <Card.Section mb={10}>
                            {it.link ?
                                <video src={it.link} controls width="100%"></video> :
                                <>
                                    <AspectRatio ratio={16 / 9} maw={400} mx="auto" pos="relative" bg="#222222">
                                        <Flex justify="center" align="center"><Loader z={1000}></Loader></Flex>
                                    </AspectRatio>
                                </>

                            }
                        </Card.Section>

                        <Text size="sm" c="dimmed" mb={12}>
                            <b>Timecode:</b>
                            <br/>{it.timecode} - {secondsToHMS(hmsToSecondsOnly(it.timecode) + hmsToSecondsOnly(it.length))}
                        </Text>
                        <Text size="sm" c="dimmed">
                            <b>Comments:</b> <br/>{it.comment?.trim() ?? <i>No Comment Left</i>}
                        </Text>


                        {it.link ? <Group w="100%" justify="space-around">
                            <Link href={it.link} target="_blank">
                                <ActionIcon hiddenFrom="md" size="lg" color="blue" mt="md">
                                    <FaArrowUpRightFromSquare/>
                                </ActionIcon>
                                <Button visibleFrom="md" color="blue" mt="md">
                                    Open in new tab
                                </Button>
                            </Link>
                            <Link download href={it.link} target="_blank">
                                <ActionIcon hiddenFrom="md" size="lg" color="blue" mt="md">
                                    <FaFileDownload/>
                                </ActionIcon>
                                <Button visibleFrom="md" color="blue" mt="md">
                                    Download
                                </Button>
                            </Link>
                        </Group> : <Group w="100%" justify="space-around">
                            <ActionIcon disabled hiddenFrom="md" size="lg" color="blue" mt="md">
                                <FaArrowUpRightFromSquare/>
                            </ActionIcon>
                            <Button disabled visibleFrom="md" color="blue" mt="md">
                                Open in new tab
                            </Button>
                            <ActionIcon disabled hiddenFrom="md" size="lg" color="blue" mt="md">
                                <FaFileDownload/>
                            </ActionIcon>
                            <Button disabled visibleFrom="md" color="blue" mt="md">
                                Download
                            </Button>
                        </Group>}
                    </Card>
                </Grid.Col>)}
            </Grid> : <Paper h="80%" ta="center">
                <Flex direction="column" h="100%" justify="space-evenly" p={30}>
                    <Text fs="italic" c="dimmed">There are no clips recorded for this game. <br/> Add one by
                        pressing &apos;Add Clip&apos; above!</Text>
                </Flex>
            </Paper>}
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
                            copyToClip(pathname)
                        }}>Share</Button>
                    </Popover.Target>
                    <Popover.Dropdown>
                        <Text c={state.value === undefined ? 'red' : 'green'}
                              fw={600}>{state.value === undefined ? `Copy failed: ${state.error}` : 'Link Copied!'}</Text>
                    </Popover.Dropdown>
                </Popover>


            </Group>
        </Flex>
    </Box>;
}
