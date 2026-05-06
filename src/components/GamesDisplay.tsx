import {AspectRatio, Box, Card, Center, Flex, Grid, Group, Paper, Skeleton, Text} from "@mantine/core";
import Link from "next/link";
import Image from "next/image";
import {Game} from "@/database/database";
import classes from '@/components/GamesDisplay.module.css'
import {HTMLAttributes, useEffect, useState} from "react";
import {useInterval} from "react-use";

function PulsingDot(props: HTMLAttributes<HTMLDivElement>) {
    return <span className={classes.statusdot} {...props}></span>
}

interface GamesDisplayProps {
    games: Game[] | null;
    missingMessage: string;
    createLink?: (it: Game) => string;
    error?: string | null;
}

const MINUTE_IN_MS = 1000 * 60;
const HOUR_IN_MS = MINUTE_IN_MS * 60;
const WEEK_IN_MS = 7 * 24 * HOUR_IN_MS;

const DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
]

function getDateString(it: number, currentTime: number): string {
    const dateToRender = new Date(it);
    const today = new Date(currentTime);
    const deltaHours = Math.floor(Math.abs(dateToRender.getTime() - today.getTime()) / (HOUR_IN_MS));
    if (deltaHours < 1) {
        const deltaMinutes = Math.floor(Math.abs(dateToRender.getTime() - today.getTime()) / (MINUTE_IN_MS));
        if (deltaMinutes < 1) {
            if (dateToRender.getTime() > today.getTime()) {
                return `Soon!`;
            } else {
                return `Now!`;
            }
        }
        if (dateToRender.getTime() > today.getTime()) {
            return `In ${deltaMinutes} minutes`;
        } else {
            return `${deltaMinutes} minutes ago`;
        }
    }
    if (deltaHours <= 10) {
        if (dateToRender.getTime() > today.getTime()) {
            return `In ${deltaHours} hours`;
        } else {
            return `${deltaHours} hours ago`;
        }
    }

    const s = dateToRender.toLocaleTimeString().replace(/:\d\d\s/, ' ');
    if (dateToRender.getDate() === today.getDate() - 1) {
        return `Yesterday, ${s}`
    } else if (dateToRender.getDate() === today.getDate() + 1) {
        return `Tomorrow, ${s}`
    } else if (dateToRender.getDate() === today.getDate()) {
        return `${s}`
    } else if (Math.abs(dateToRender.getTime() - today.getTime()) / WEEK_IN_MS < 1) {
        const prefix = dateToRender.getTime() > today.getTime() ? 'Next' : 'Last'
        return `${prefix} ${DAYS[dateToRender.getDay()]}, ${s}`
    }

    return dateToRender.toLocaleString()
}

export function GamesDisplay({
                                 games,
                                 missingMessage,
                                 createLink = it => `/${it.blob}`,
                                 error = null
                             }: GamesDisplayProps) {
    const [currentTime, setCurrentTime] = useState<number>(-1);
    useEffect(() => {
        setCurrentTime(Date.now());
    }, [])
    useInterval(
        () => {
            setCurrentTime(Date.now());
        },
        5000
    )

    if (error) {
        return <Paper h={100} ta="center" >
            <Flex direction="column" h="100%" justify="space-evenly">
                <Text fs="italic" c="dimmed">{error}</Text>
            </Flex>
        </Paper>
    }

    if (!games) {
        return <Grid flex={3} w="100%" p={20} overflow="scroll">
            {Array.from({length: 10})?.map((_, i) => <Grid.Col key={i} span={{
                    base: 6,
                    md: 2
                }}>
                    <Card shadow="sm" padding="lg" withBorder>
                        <Card.Section p={20}>
                            <Skeleton height={16} mb={6} radius="xl"></Skeleton>
                            <Skeleton height={10} w="70%" radius="xl"></Skeleton>
                        </Card.Section>
                        <Card.Section mb={10}>
                            <Group h={120} w="100$" justify="space-evenly" m={5}>
                                <AspectRatio w="40%" ratio={1}>
                                    <Skeleton h="100%" circle radius="xl"/>
                                </AspectRatio>
                                <AspectRatio w="40%" ratio={1}>
                                    <Skeleton h="100%" circle radius="xl"/>
                                </AspectRatio>
                            </Group>


                        </Card.Section>

                        <Skeleton height={10} mb={12} w={40}></Skeleton>
                        <Skeleton height={8}></Skeleton>

                    </Card>


                </Grid.Col>
            )}
        </Grid>
    }

    return games.length ? <Grid flex={3} w="100%" overflow="scroll">
            {games.map((it) => <Grid.Col key={it.blob} span={{
                    base: 6,
                    md: 2
                }}>
                    <Link href={createLink(it)}>
                        <Card shadow="sm" padding="xs" withBorder>
                            {it.isLive && <Box h={0}>
                                <PulsingDot style={{float: 'right', margin: 5}}/>
                            </Box>}
                            <Card.Section pt={10}>
                                <Text fz="1.4em" ta="center" fw={600}>{it.teamOne} vs {it.teamTwo}</Text>
                                <Text fz="1em" ta="center"><i>{it.competitionName}</i></Text>
                            </Card.Section>
                            <Card.Section mb={10}>

                                <Group h={120} w="100%" justify="center" mb={5} pl={5} pr={5}>
                                    <Center w="45%"><Image src={it.teamOneImage} alt="Home team image"
                                                           width={100} height={100}/></Center>
                                    <Center w="45%"><Image src={it.teamTwoImage} alt="Away team image"
                                                           width={100} height={100}/></Center>
                                </Group>

                            </Card.Section>

                            <Text size="sm" c="dimmed" mb={12}>
                                <b>Start Time:</b>
                                <br/>{it.isLive ? 'Live!' : getDateString(it.startTime, currentTime)}
                            </Text>

                        </Card>
                    </Link>
                </Grid.Col>
            )}
        </Grid> :
        <Paper h={100} ta="center">
            <Flex direction="column" h="100%" justify="space-evenly">
                <Text fs="italic" c="dimmed">{missingMessage}</Text>
            </Flex>
        </Paper>

}