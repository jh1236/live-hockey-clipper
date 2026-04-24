"use client";

import {useEffect, useState} from "react";
import {Button, Card, Flex, Grid, Text, Title} from "@mantine/core";
import {hmsToSecondsOnly, secondsToHMS} from "@/utils";
import Link from "next/link";

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
            {clips?.map((it, i) => <Grid.Col key={it.name} span={6}>
                <Card shadow="sm" padding="lg" withBorder>
                    <Card.Section>
                        <video src={it.link} controls></video>
                    </Card.Section>
                    <Text fw={500} p={10}>{it.name}</Text>
                    <Text size="sm" c="dimmed">
                        Starts: {it.timecode} {'\n'}
                        Ends: {secondsToHMS(hmsToSecondsOnly(it.timecode) + hmsToSecondsOnly(it.length))}
                    </Text>

                    <Link href={it.link!} target="_blank">
                        <Button color="blue" fullWidth mt="md">
                            Open in new tab
                        </Button>
                    </Link>
                </Card>
            </Grid.Col>)}
        </Grid>
    </Flex>
}