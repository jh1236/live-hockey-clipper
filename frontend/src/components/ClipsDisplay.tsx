import {Clip, SERVER_ADDRESS} from "@/serverTypes";
import {
    ActionIcon,
    AspectRatio,
    Badge, Box,
    Button,
    Card,
    Center,
    Flex,
    Grid,
    Group,
    Loader,
    Paper,
    Text
} from "@mantine/core";
import {hmsToSecondsOnly, secondsToHMS} from "@/utils";
import Link from "next/link";
import {FaArrowUpRightFromSquare, FaRegStar, FaStar} from "react-icons/fa6";
import {FaFileDownload} from "react-icons/fa";
import {Dispatch, SetStateAction} from "react";

interface ClipsDisplayProps {
    clips: Clip[]
    setClips?: Dispatch<SetStateAction<Clip[] | null>>;
    editable?: boolean
    error?: string
    noClipMessage: string | React.ReactElement
}

export function ClipsDisplay({clips, setClips, editable = false, noClipMessage}: ClipsDisplayProps) {
    return <>
        {clips.length ? <Grid flex={3} w="100%" h="80%" p={20} overflow="scroll">
            {clips.map((it, i) => <Grid.Col key={it.name + !!it.link} span={{
                base: 6,
                md: 3
            }}>
                <Card shadow="sm" padding="lg" withBorder>
                    <Box h={0} pos="relative">
                        {editable && <ActionIcon
                            right={0}
                            pos="absolute"
                            loading={it.favourite === undefined}
                            variant="subtle"
                            onClick={() => {
                                const oldValue = clips[i].favourite!;
                                setClips!(prev => prev!.map((clip, idx) => i === idx ? {
                                    ...it,
                                    favourite: undefined
                                } : clip) ?? null)
                                fetch(`${SERVER_ADDRESS}/api/clips/favourite`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': "application/json",
                                    },
                                    body: JSON.stringify({
                                        clipName: it.name,
                                        gameBlob: it.gameBlob,
                                        // we avoid using it here because of closures (i think)
                                        favourite: !oldValue
                                    })
                                }).then(it => it.json()).then(({clip}) => {
                                    setClips!(prev => prev!.map(it => it.name === clip.name ? clip : it))
                                })

                            }}>
                            {it.favourite ? <FaStar color="yellow"/> : <FaRegStar/>}
                        </ActionIcon>}
                    </Box>
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
                    {it.categories?.length ?
                        <Group my={10}>
                            {it.categories.map(it => <Badge color="blue" key={it}>{it}</Badge>)}
                        </Group>
                        : <i>No Comment Left</i>}
                    <Text size="sm" c="dimmed" mb={12}>
                        <b>Timecode:</b>
                        <br/>{it.timecode} - {secondsToHMS(hmsToSecondsOnly(it.timecode) + hmsToSecondsOnly(it.length))}
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
            <Flex direction="column" h="100%" justify="center" p={30}>
                <Text fs="italic" c="dimmed">{noClipMessage}</Text>
            </Flex>
        </Paper>}
    </>;
}