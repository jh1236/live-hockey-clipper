"use client";

import {useEffect, useState} from "react";
import {ActionIcon, Button, Card, Flex, Grid, Group, Text, Title} from "@mantine/core";
import {hmsToSecondsOnly, secondsToHMS} from "@/utils";
import Link from "next/link";

import {FaFileDownload} from "react-icons/fa";
import {redirect} from "next/navigation";
import {FaArrowUpRightFromSquare} from "react-icons/fa6";

interface ViewClipsParams {
    blob: string;
}

export function ViewClips({blob}: ViewClipsParams) {
    const [clips, setClips] = useState<{
        timecode: string,
        length: string,
        name: string,
        link?: string,
    }[]>([]);
    const [game, setGame] = useState<{
        teamOne: string,
        teamTwo: string,
        teamOneImage: string,
        teamTwoImage: string,
        competitionName: string,
    }>()

    useEffect(() => {
        if (blob) {
            fetch(`/api/clips/get?blob=${blob}`).then(res => res.json()).then(data => {
                setClips(data.clips)
                setGame(data.game)
            });
        }
    }, [blob]);


    return <Flex h="100svh" w="100svw" justify="center" align="center" direction="column">
        <Title p={20}>{game ? `${game.competitionName}: ${game.teamOne} vs ${game.teamTwo}`: "Loading"}</Title>
        <Grid flex={9} w="100%" p={20}>
            {clips?.map((it) => <Grid.Col key={it.name} span={6}>
                <Card shadow="sm" padding="lg" withBorder>
                    <Card.Section>
                        <video src={it.link} controls></video>
                    </Card.Section>
                    <Text fw={500} p={10}>{it.name}</Text>
                    <Text size="sm" c="dimmed">
                        <b>Starts:</b> {it.timecode} <br/>
                        <b>Ends:</b> {secondsToHMS(hmsToSecondsOnly(it.timecode) + hmsToSecondsOnly(it.length))}
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
        <Button onClick={() => redirect('/')}>Go Back</Button>
    </Flex>
}