"use client";

import {useEffect, useState} from "react";
import {useBoolean, useInterval, useLocalStorage, useSessionStorage} from "react-use";
import {
    ActionIcon,
    Box,
    Button,
    Card,
    Center,
    Flex,
    Grid,
    Group,
    Loader,
    LoadingOverlay,
    Modal,
    Popover,
    Stack,
    Text,
    TextInput,
    Tooltip
} from "@mantine/core";
import {hmsToSecondsOnly, secondsToHMS} from "@/utils";
import {FaMinus, FaUndo} from "react-icons/fa";
import {redirect} from "next/navigation";
import {Clip} from "@/ServerClipManager";

const PRIOR_CLIP_RECORDING = 10;
export default function Home() {
    const [clips, setClips] = useSessionStorage<Clip[]>("clips", [], false);
    const [isLoading, setIsLoading] = useState(false);
    const [openExport, setOpenExport] = useBoolean(false);
    const [openAddClips, setOpenAddClips] = useBoolean(false);
    const [gameBlob, setGameBlob] = useState<string>("");
    const [commentForNewClip, setCommentForNewClip] = useState<string>("");
    const [nameOfNewClip, setNameOfNewClip] = useState<string>("Clip 1");
    const [durationToClip, setDurationToClip] = useState<string>('00:00:00');
    const [timeToClip, setTimeToClip] = useState<string>('00:00:00');
    const [currentTime, setCurrentTime] = useState<number>(-1);
    const [startTime, setStartTime] = useSessionStorage<number>("startTime", -1);
    const [editIndex, setEditIndex] = useState<number>(-1);
    const [username] = useLocalStorage<string | null>("username", null);
    const [password] = useLocalStorage<string | null>("password", null);

    useInterval(
        () => {
            setCurrentTime(Date.now());
        },
        (startTime ?? 0) > 0 ? 500 : null
    )

    useEffect(() => {
        setCurrentTime(Date.now());
    }, [startTime]);


    if (!username) {
        return <Flex h="100svh" w="100svw" justify="center" align="center" direction="column">
            <Text><i>To use this site, you must be logged into live hockey</i></Text>
            <Button bg="red" size="xl" w="80%" h="30%" m={30} onClick={() => redirect('/login')}>Login</Button>
        </Flex>
    }

    if (!startTime || startTime <= 0) {
        return <Flex h="100svh" w="100svw" justify="center" align="center" direction="column">
            <Text><i>Press this button when the first quarter starts</i></Text>
            <Button size="xl" w="80%" h="30%" m={30} onClick={() => setStartTime(Date.now())}>Start Timer</Button>
        </Flex>
    }

    const gameBlobError = !/^[0-9a-zA-Z]*$/.test(gameBlob);
    const durationError = !/^(\d?\d:)?(\d\d:)?\d\d$/.test(durationToClip);
    const clipNameError = !nameOfNewClip || (clips?.filter((_, i) => i !== editIndex)?.map(it => it.name).includes(nameOfNewClip));
    const timeToClipError = !/^(\d?\d:)?(\d\d:)?\d\d$/.test(timeToClip);

    return <Box>
        <LoadingOverlay visible={isLoading} zIndex={1000} overlayProps={{radius: "sm", blur: 2}}
                        loaderProps={{children: <Stack>
                                This will take a while, do not close this tab!
                                <Loader color="blue" />
                            </Stack>}}/>
        <Modal opened={openExport} onClose={() => setOpenExport(isLoading)} title="Download Clips" centered>
            <TextInput mt={10} mb={10} label="Game link"
                       description="Paste in the link to the game on LiveHockey"
                       value={gameBlob}
                       error={gameBlobError ? 'Game blob should only contain letters and numbers!' : undefined}
                       onChange={(e) => setGameBlob(e.target.value.replace(/.*\/game\//, ""))}/>
            <TextInput mt={10} mb={10} label="Game Start Time"
                       description="Set this to the livestream timestamp that the first quarter began"
                       value={timeToClip}
                       error={timeToClipError ? 'Malformed Timestamp!' : undefined}
                       onChange={e => setTimeToClip(e.target.value)}/>
            <Tooltip label={<>
                {!gameBlob && <>You must provide a link to the game!<br/></>}
                {gameBlobError && <>Game blob should only contain letters and numbers!<br/></>}
                {timeToClipError && <>The timestamp {timeToClip} is not valid!<br/></>}
            </>} disabled={!!gameBlob && !timeToClipError && !gameBlobError}>

                <Button bg="green" mt={10} mb={10}
                        data-disabled={!gameBlob || timeToClipError || gameBlobError}
                        loading={isLoading}
                        onClick={() => {
                            setIsLoading(true)
                            fetch('/api/clips/create', {
                                method: "POST", body: JSON.stringify({
                                    clips,
                                    username,
                                    password,
                                    gameBlob
                                })
                            }).then(() => {
                                setClips([])
                                setStartTime(-1)
                                redirect(`/${gameBlob}`)
                            })
                        }}>Download Clips</Button></Tooltip>
        </Modal>
        <Modal opened={openAddClips} onClose={() => setOpenAddClips(false)} title="Add Clip" centered>
            <TextInput mt={10} mb={10} label="Clip title"
                       description="File name for this clip"
                       error={!nameOfNewClip ?
                           "You must provide a name for the clip! " :
                           clipNameError ? `The name '${nameOfNewClip}' is already in use!` : undefined}
                       value={nameOfNewClip}
                       onChange={e => setNameOfNewClip(e.target.value)}/>
            <TextInput mt={10} mb={10} label="Clip Comments"
                       description="Details about the clip"
                       placeholder="Your comment here"
                       value={commentForNewClip}
                       onChange={e => setCommentForNewClip(e.target.value)}/>
            <TextInput mt={10} mb={10} label="Clip Start"
                       description={`Defaults to ${PRIOR_CLIP_RECORDING} seconds before the button was pressed`}
                       value={timeToClip}
                       placeholder="--:--:--"
                       error={timeToClipError ? 'Malformed Timestamp!' : undefined}
                       onChange={e => setTimeToClip(e.target.value)}/>
            <TextInput mt={10} mb={10} label="Clip Duration"
                       description="How long the clip will record for"
                       placeholder="--:--:--"
                       value={durationToClip}
                       error={durationError ? 'Malformed Timestamp!' : undefined}
                       onChange={e => setDurationToClip(e.target.value)}/>
            <Tooltip label={<>
                {!nameOfNewClip ?
                    <>You must provide a name for the clip!<br/></> :
                    clipNameError && <>The name &apos;{nameOfNewClip}&apos; is already in use!<br/></>}
                {timeToClipError && <>The Clip Start timestamp ({timeToClip}) is not valid!<br/></>}
                {durationError && <>The Duration timestamp ({timeToClip}) is not valid!<br/></>}
            </>} disabled={!durationError && !timeToClipError && !clipNameError}>
                <Button bg="green" mt={10} mb={10}
                        disabled={durationError || timeToClipError || clipNameError}
                        onClick={() => {
                            const newClip = {
                                name: nameOfNewClip!,
                                timecode: timeToClip,
                                length: durationToClip,
                                comment: commentForNewClip,
                            };
                            if (editIndex < 0) {
                                setClips([...clips!, newClip])
                            } else {
                                setClips(clips?.map((it, i) =>
                                    i !== editIndex ? it : newClip)
                                )
                            }
                            setOpenAddClips(false)
                        }}>Save Clip</Button>
            </Tooltip>
        </Modal>

        <Flex h="100svh" w="100svw" justify="space-around" align="center" direction="column">
            <Group><Text p={20} fz="2em"><b>Clip Time:</b> {secondsToHMS(Math.round((currentTime - startTime) / 1000))}
            </Text>
                <Popover>
                    <Popover.Target>
                        <ActionIcon size="xl" bg="gray"><FaUndo size={20}/></ActionIcon>
                    </Popover.Target>
                    <Popover.Dropdown>
                        <Stack align="center">
                            <Text>Are you sure you want to reset? <br/>All clip times will be removed!</Text>
                            <Button bg="red"
                                    onClick={() => {
                                        setClips([])
                                        setStartTime(-1)
                                    }}>Yes</Button>
                        </Stack>
                    </Popover.Dropdown>
                </Popover>
            </Group>
            <Button size="xl" w="60%" m={30} onClick={() => {
                setTimeToClip(
                    secondsToHMS(Math.max(Math.round((currentTime - startTime) / 1000) - PRIOR_CLIP_RECORDING, 0))
                );
                setDurationToClip(secondsToHMS(PRIOR_CLIP_RECORDING * 2, false));
                setNameOfNewClip(`Clip ${clips?.length ?? 1}`)
                setEditIndex(-1)
                setOpenAddClips(true);
            }}>Add Clip</Button>
            <Grid flex={3} w="100%" p={20}>
                {clips?.map((it, i) => <Grid.Col key={it.name} span={{
                    base: 6,
                    md: 3
                }}>
                    <Card shadow="sm" padding="lg" withBorder>
                        <Box w="100%" h={0}>
                            <Popover>
                                <Popover.Target>
                                    <ActionIcon style={{float: 'right'}} m={5}>
                                        <FaMinus size={20}/>
                                    </ActionIcon>
                                </Popover.Target>
                                <Popover.Dropdown>
                                    <Stack align="center">
                                        <Text>Are you sure that you want to remove this clip? <br/>This cannot be
                                            undone!</Text>
                                        <Button bg="red"
                                                onClick={() => setClips(clips!.filter((_, idx) => idx !== i))}>
                                            Yes
                                        </Button>
                                    </Stack>
                                </Popover.Dropdown>
                            </Popover>
                        </Box>
                        <Card.Section p={10}>
                            <Center>
                                <Text fz="1.2em" fw={600}>{it.name}</Text>
                            </Center>
                        </Card.Section>

                        <Text size="sm" c="dimmed">
                            <b>Timecode:</b> {it.timecode} - {secondsToHMS(hmsToSecondsOnly(it.timecode) + hmsToSecondsOnly(it.length))}
                        </Text>
                        <Text size="sm" c="dimmed">
                            <b>Comments:</b> {it.comment ?? <i>No Comment Left</i>}
                        </Text>

                        <Button color="blue" fullWidth mt="md" onClick={() => {
                            setEditIndex(i)
                            setTimeToClip(it.timecode);
                            setDurationToClip(it.length);
                            setNameOfNewClip(it.name)
                            setOpenAddClips(true);
                        }}>
                            Edit
                        </Button>
                    </Card>
                </Grid.Col>)}
            </Grid>
            <Tooltip label="You must have at least one clip to export footage!" disabled={clips.length > 0}>
                <Button bg="red" p={10} m={20} size="lg"
                        data-disabled={clips.length === 0}
                        onClick={e => {
                            if (clips.length === 0) {
                                e.preventDefault();
                            } else {
                                setTimeToClip("00:00:00")
                                setOpenExport(true)
                            }
                        }}>Done</Button>

            </Tooltip>
        </Flex>
    </Box>;
}
