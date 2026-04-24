"use client";

import {useEffect, useState} from "react";
import {useBoolean, useInterval, useLocalStorage} from "react-use";
import {ActionIcon, Box, Button, Card, Flex, Grid, Group, Modal, Text, TextInput, Title} from "@mantine/core";
import {hmsToSecondsOnly, secondsToHMS} from "@/utils";
import {FaMinus} from "react-icons/fa";
import {redirect} from "next/navigation";

const PRIOR_CLIP_RECORDING = 10;
export default function Home() {
    const [clips, setClips] = useLocalStorage<{
        timecode: string,
        length: string,
        name: string,
        link?: string,
    }[]>("clips", [], {raw: false, serializer: JSON.stringify, deserializer: JSON.parse});
    const [isLoading, setIsLoading] = useState(false);
    const [openExport, setOpenExport] = useBoolean(false);
    const [openAddClips, setOpenAddClips] = useBoolean(false);
    const [gameBlob, setGameBlob] = useState<string>("");
    const [nameOfNewClip, setNameOfNewClip] = useState<string>("Clip 1");
    const [durationToClip, setDurationToClip] = useState<string>('00:00:00');
    const [timeToClip, setTimeToClip] = useState<string>('00:00:00');
    const [currentTime, setCurrentTime] = useState<number>(-1);
    const [startTime, setStartTime] = useLocalStorage<number>("startTime", -1);
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

    // useEffect(() => {
    //     // if our timer goes over 2 hours, then the game we were doing is probably finished
    //     if (startTime! > 0 && currentTime - startTime! > hmsToSecondsOnly("2:30:00")) {
    //         setStartTime(0)
    //         setClips([])
    //     }
    // }, [setStartTime, startTime]);


    if (!startTime || startTime <= 0) {
        return <Flex h="100svh" w="100svw" justify="center" align="center" direction="column">
            <Text><i>Press this button when the first quarter starts</i> {startTime}</Text>
            <Button size="xl" w="80%" h="30%" m={30} onClick={() => setStartTime(Date.now())}>Start Timer</Button>
        </Flex>
    }

    const durationError = !/^(\d?\d:)?(\d\d:)?\d\d$/.test(durationToClip);
    const clipNameError = !nameOfNewClip || (clips?.filter((_, i) => i !== editIndex)?.map(it => it.name).includes(nameOfNewClip));
    const timeToClipError = !/^(\d?\d:)?(\d\d:)?\d\d$/.test(timeToClip);

    return <Box>
        {/*By using isLoading as our value of setOpenBox, the box won't close whilst it's downloading*/}
        <Modal opened={openExport} onClose={() => setOpenExport(isLoading)} title="Download Clips" centered>
            <Text>This will take a while, do</Text>
            <TextInput mt={10} mb={10} label="Game Blob"
                       description="Paste in the link to the game on LiveHockey"
                       value={gameBlob}
                       onChange={(e) => setGameBlob(e.target.value.replace(/.*\/game\//, ""))}/>
            <TextInput mt={10} mb={10} label="Offset"
                       description={`Set this to the livestream timestamp that the first quarter began.`}
                       value={timeToClip}
                       error={timeToClipError ? 'Malformed Timestamp!' : undefined}
                       onChange={e => setTimeToClip(e.target.value)}/>
            <Button bg="green" mt={10} mb={10}
                    disabled={!gameBlob || timeToClipError}
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
                    }}>Download Clips</Button>
        </Modal>
        <Modal opened={openAddClips} onClose={() => setOpenAddClips(false)} title="Add Clip" centered>
            <TextInput mt={10} mb={10} label="Clip title"
                       placeholder={`clip ${clips?.length ?? 1}`}
                       value={nameOfNewClip}
                       onChange={e => setNameOfNewClip(e.target.value)}/>
            <TextInput mt={10} mb={10} label="Clip Start"
                       description={`Defaults to ${PRIOR_CLIP_RECORDING} seconds before the button was pressed`}
                       value={timeToClip}
                       error={timeToClipError ? 'Malformed Timestamp!' : undefined}
                       onChange={e => setTimeToClip(e.target.value)}/>
            <TextInput mt={10} mb={10} label="Clip Duration"
                       value={durationToClip}
                       error={durationError ? 'Malformed Timestamp!' : undefined}
                       onChange={e => setDurationToClip(e.target.value)}/>
            <Button bg="green" mt={10} mb={10}
                    disabled={durationError || timeToClipError || clipNameError}
                    onClick={() => {
                        if (editIndex < 0) {
                            setClips([...clips!, {
                                timecode: timeToClip,
                                length: durationToClip,
                                name: nameOfNewClip!,
                            }])
                        } else {
                            setClips(clips?.map((it, i) =>
                                i !== editIndex ? it :
                                    {
                                        timecode: timeToClip,
                                        length: durationToClip,
                                        name: nameOfNewClip!,
                                    }))
                        }
                        setOpenAddClips(false)
                    }}>Save Clip</Button>
        </Modal>

        <Flex h="100svh" w="100svw" justify="space-around" align="center" direction="column">
            <Text p={20} fz="2em"><b>Clip Time:</b> {secondsToHMS(Math.round((currentTime - startTime) / 1000))}</Text>
            <Button size="xl" w="60%" m={30} onClick={() => {
                setTimeToClip(
                    secondsToHMS(Math.max(Math.round((currentTime - startTime) / 1000) - PRIOR_CLIP_RECORDING, 0))
                );
                setDurationToClip(secondsToHMS(PRIOR_CLIP_RECORDING * 2, false));
                setNameOfNewClip(`Clip ${clips?.length ?? 1}`)
                setEditIndex(-1)
                setOpenAddClips(true);
            }}>Add Clip</Button>
            <Button bg="red" p={10} m={20} size="lg" onClick={() => {
                setTimeToClip("00:00:00")
                setOpenExport(true)
            }}>Export</Button>
            <Grid flex={3} w="100%" p={20}>
                {clips?.map((it, i) => <Grid.Col key={it.name} span={6}>
                    <Card shadow="sm" padding="lg" withBorder>
                        <Card.Section>
                            <Group>
                                <Text fw={500} p={10}>{it.name}</Text>
                                <ActionIcon m={5} onClick={() => setClips(it => it!.filter((_, idx) => idx !== i))}>
                                    <FaMinus size={20}/>
                                </ActionIcon> </Group>
                        </Card.Section>


                        <Text size="sm" c="dimmed">
                            Starts: {it.timecode} {'\n'}
                            Ends: {secondsToHMS(hmsToSecondsOnly(it.timecode) + hmsToSecondsOnly(it.length))}
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

        </Flex>
    </Box>;
}
