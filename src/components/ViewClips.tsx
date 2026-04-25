"use client";

import {useEffect, useState} from "react";
import {ActionIcon, Box, Button, Card, Center, Flex, Grid, Group, Skeleton, Text, Title} from "@mantine/core";
import {hmsToSecondsOnly, secondsToHMS} from "@/utils";
import Link from "next/link";

import {FaFileDownload} from "react-icons/fa";
import {FaArrowUpRightFromSquare} from "react-icons/fa6";
import {Clip} from "@/ServerClipManager";

interface ViewClipsParams {
    blob: string;
}

export function ViewClips({blob}: ViewClipsParams) {
    const [clips, setClips] = useState<Clip[] | null>(null);
    const [game, setGame] = useState<{
        teamOne: string,
        teamTwo: string,
        teamOneImage: string,
        teamTwoImage: string,
        competitionName: string,
    } | null>(null)

    useEffect(() => {
        if (blob) {
            fetch(`/api/clips/get?blob=${blob}`).then(res => res.json()).then(data => {
                setClips(data.clips)
                setGame(data.game)
            });
        }
    }, [blob]);


    if (clips === null || game === null) {
        return <Flex h="100svh" justify="center" align="center" direction="column">
            <Title p={20}>Loading</Title>
            <Grid flex={9} w="100%" p={20} overflow="scroll">
                {Array.from({length: 5}).map((_, i) => <Grid.Col key={i} span={{
                    base: 6,
                    md: 3
                }}>
                    <Card shadow="sm" padding="lg" withBorder>
                        <Card.Section p={15}>
                            <Center>
                                <Skeleton height={12} radius="xl"></Skeleton>
                            </Center>
                        </Card.Section>
                        <Card.Section mb={10} p={10}>
                            <Skeleton w="100%" hiddenFrom="md" radius="md" h={100}></Skeleton>
                            <Skeleton w="100%" visibleFrom="md" radius="md" h={200}></Skeleton>
                        </Card.Section>


                        <b>Timecode:</b> <Skeleton mb={12} height={8} radius="xl" w="50%"></Skeleton>

                        <b>Comments:</b>
                        <Skeleton height={8} radius="xl"></Skeleton>
                        <Skeleton height={8} mt={6} radius="xl"></Skeleton>
                        <Skeleton height={8} mt={6} radius="xl" w="70%"></Skeleton>


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
            <Box p={20}>
                <Button disabled>Go Back</Button>
            </Box>
        </Flex>
    }

    return <Flex h="100svh" justify="center" align="center" direction="column">
        <Title p={20}>{game.competitionName}: {game.teamOne} vs {game.teamTwo}</Title>
        <Grid flex={9} w="100%" p={20} overflow="scroll">
            {clips?.map((it) => <Grid.Col key={it.name} span={{
                base: 6,
                md: 3
            }}>
                <Card shadow="sm" padding="lg" withBorder>
                    <Card.Section p={10}>
                        <Center>
                            <Text fz="1.2em" fw={600}>{it.name}</Text>
                        </Center>
                    </Card.Section>
                    <Card.Section mb={10}>
                        <video src={it.link} controls width="100%"></video>
                    </Card.Section>

                    <Text size="sm" c="dimmed" mb={12}>
                        <b>Timecode:</b>
                        <br/>{it.timecode} - {secondsToHMS(hmsToSecondsOnly(it.timecode) + hmsToSecondsOnly(it.length))}
                    </Text>
                    <Text size="sm" c="dimmed">
                        <b>Comments:</b> <br/>{it.comment ?? <i>No Comment Left</i>}
                    </Text>


                    <Group w="100%" justify="space-around">
                        <Link href={it.link!} target="_blank">
                            <ActionIcon hiddenFrom="md" size="lg" color="blue" mt="md">
                                <FaArrowUpRightFromSquare/>
                            </ActionIcon>
                            <Button visibleFrom="md" color="blue" mt="md">
                                Open in new tab
                            </Button>
                        </Link>
                        <Link download href={it.link!} target="_blank">
                            <ActionIcon hiddenFrom="md" size="lg" color="blue" mt="md">
                                <FaFileDownload/>
                            </ActionIcon>
                            <Button visibleFrom="md" color="blue" mt="md">
                                Download
                            </Button>
                        </Link>
                    </Group>
                </Card>
            </Grid.Col>)}
        </Grid>
        <Box p={20}>
            <Link href="/">
                <Button>Go Back</Button>
            </Link>
        </Box>
    </Flex>
}