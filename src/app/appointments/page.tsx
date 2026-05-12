'use client'

import {BarChart, LineChart, PieChart} from "@mantine/charts";
import {Grid, Group, Select, Title, Text} from "@mantine/core";
import {useEffect, useMemo, useState} from "react";
import {getMonday} from "@/utils";

type Game = {
    altius_id: string,
    start_time: number,
    umpires: string[],
    teams: string[],
    grade: string,
    tournament_id: number
}

const COLORS = [
    '#e6194b',
    '#3cb44b',
    '#ffe119',
    '#4363d8',
    '#f58231',
    '#911eb4',
    '#46f0f0',
    '#f032e6',
    '#bcf60c',
    '#fabebe',
    '#008080',
    '#e6beff',
    '#9a6324',
    '#fffac8',
    '#800000',
    '#aaffc3',
    '#808000',
    '#ffd8b1',
    '#000075',
    '#808080',
]

export default function Page() {
    const [ladder, setLadder] = useState<{ [tournament: string]: string[] }>({});
    const [data, setData] = useState<Game[]>([]);
    const [genders, setGenders] = useState<{ [key: string]: 'M' | 'F' }>({});
    const [grade, setGrade] = useState<string | null>(null);
    useEffect(() => {
        fetch('http://localhost:5000').then(res => res.json()).then(setData);
        fetch('http://localhost:5000/ladder').then(res => res.json()).then(setLadder);
        fetch('http://localhost:5000/genders').then(res => res.json()).then(setGenders);
    }, []);

    const umpires = useMemo(() => data.flatMap(it => it.umpires)
        .filter((v, i, arr) => arr.indexOf(v) === i), [data])
    const grades = useMemo(() => data.map(it => it.grade)
        .filter((v, i, arr) => arr.indexOf(v) === i).sort(), [data])

    const gradeData = useMemo(() => !grade ? data : data.filter(it => it.grade === grade), [data, grade])

    const gamesPerUmpire = useMemo(() => {
        const outMap = new Map<string, number>();
        for (const game of gradeData) {
            for (const umpire of game.umpires) {
                outMap.set(umpire, (outMap.get(umpire) ?? 0) + 1)
            }
        }
        return [...outMap.entries().map(([name, value], i) => ({
            name,
            value,
            color: COLORS[i % 20]
        }))].sort((a, b) => a.value - b.value);
    }, [gradeData])

    const averageLadderForUmpire = useMemo(() => {
        if (!ladder) return []
        const gamesForOfficial = new Map<string, Game[]>();
        for (const game of gradeData) {
            for (const umpire of game.umpires) {
                gamesForOfficial.set(umpire, [...(gamesForOfficial.get(umpire) ?? []), game])
            }
        }
        console.log(ladder)
        return [...gamesForOfficial.entries().filter(([, games]) => games.length > 1).map(([name, games]) => ({
            name: name,
            'Average Ladder Position': Math.round(games.flatMap(g => g.teams.map(t => ladder[g.tournament_id.toString()].indexOf(t) + 1)).reduce((a, b) => a + b) / (2 * games.length) * 10) / 10
        }))]

    }, [gradeData, ladder])

    const averageLadderDeltaForUmpire = useMemo(() => {
        if (!ladder) return []
        const gamesForOfficial = new Map<string, Game[]>();
        for (const game of gradeData) {
            for (const umpire of game.umpires) {
                gamesForOfficial.set(umpire, [...(gamesForOfficial.get(umpire) ?? []), game])
            }
        }
        console.log(ladder)
        return [...gamesForOfficial.entries().filter(([, games]) => games.length > 1).map(([name, games]) => ({
            name: name,
            'Average Ladder Delta': Math.round(games.flatMap(g => g.teams.map(t => ladder[g.tournament_id.toString()].indexOf(t)).reduce((a, b) => Math.abs(a - b))).reduce((a, b) => a + b) / (games.length) * 10) / 10
        }))]

    }, [gradeData, ladder])

    console.log(averageLadderForUmpire)

    const gamesPerUmpirePerWeek = useMemo(() => {
        const outMap: Map<string, { [key: string]: number }> = new Map();
        for (const game of gradeData) {
            const week = getMonday(new Date(game.start_time)).toDateString();
            if (!outMap.has(week)) {
                outMap.set(week, Object.fromEntries(umpires.map(it => [it, 0])))
            }
            for (const umpire of game.umpires) {
                const toAdd = outMap.get(week) ?? {};
                outMap.set(week, Object.assign(toAdd, {[umpire]: (toAdd[umpire] ?? 0) + 1}))
            }
        }
        if (!grade) {
            for (const [week, values] of outMap.entries()) {
                const newValue: { [key: string]: number } = {}
                for (const umpire of umpires) {
                    if (values[umpire] <= 1) continue;
                    newValue[umpire] = values[umpire];
                }
                outMap.set(week, newValue);
            }
        }
        return [...outMap.entries().map(([date, value], i) => ({
            date,
            ...Object.fromEntries(Object.entries(value).filter(([k, v]) => v > 0)),
        }))].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [grade, gradeData, umpires])


    const gamesPerGender = useMemo(() => {
        const outMap = {M: 0, F: 0};
        for (const game of gradeData) {
            for (const umpire of game.umpires) {
                outMap[genders[umpire]] += 1
            }
        }
        return Object.entries(outMap).map(([k, v]) => ({
            name: k === 'M' ? 'Male' : 'Female',
            value: Math.round(100 * v / (gradeData.length * 2)),
            color: k === 'M' ? '#000088' : '#CC00CC'
        }));
    }, [genders, gradeData])

    const gamesPerGenderPerWeek = useMemo(() => {
        const outMap: Map<string, { games: number, women: number }> = new Map();
        for (const game of gradeData) {
            const week = getMonday(new Date(game.start_time)).toDateString();
            if (!outMap.has(week)) {
                outMap.set(week, {games: 0, women: 0});
            }
            for (const umpire of game.umpires) {
                outMap.get(week)!.games += 1
                if (genders[umpire] === 'M') continue;
                outMap.get(week)!.women += 1
            }
        }
        return [...outMap.entries().map(([date, value], i) => ({
            date,
            'Percentage of Games Umpired by Women': Math.round(100 * (value.women / value.games)),
        }))].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [genders, gradeData])

    return <>
        <Group w="100%" justify="center">
            <Title ta="center" m={20}>Graphs For</Title>
            <Select w={200} defaultValue="All" data={['All', ...grades]}
                    value={grade ?? 'All'}
                    onChange={it => setGrade((!it || it === 'All') ? null : it)}/>
        </Group>
        <Grid w="100%" gap={3} p={20}>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Games Umpired</Title>
                <PieChart data={gamesPerUmpire} withTooltip tooltipDataSource="segment" mx="auto" size={250}
                          startAngle={90} endAngle={360 + 90} strokeWidth={0}/>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Weekly Games</Title>
                {!grade &&
                    <Text my={5} ta="center" c="dimmed" fs="italic">Only showing umpires with 2+ games for space</Text>}
                <BarChart data={gamesPerUmpirePerWeek} withTooltip mx="auto" type="percent"
                          h={300}
                          dataKey="date"
                          series={umpires.map((name, i) => ({name, color: COLORS[i % 20]}))}/>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Games by Gender</Title>
                <PieChart data={gamesPerGender}
                          withTooltip
                          tooltipDataSource="segment"
                          mx="auto"
                          size={250}
                          labelsType="percent"
                          withLabels
                          labelsPosition="inside"
                          startAngle={90} endAngle={360 + 90} strokeWidth={0}>
                </PieChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Gender split by week</Title>
                <LineChart data={gamesPerGenderPerWeek}
                           yAxisProps={{domain: [0, 100]}}
                           h={300}
                           withTooltip
                           mx="auto" series={[{name: 'Percentage of Games Umpired by Women', color: '#CC00CC'}]}
                           dataKey="date" curveType="linear">
                </LineChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Average Ladder Position of Game</Title>
                <Text my={5} ta="center" c="dimmed" fs="italic">Lower is better</Text>
                <BarChart
                    h={300}
                    data={averageLadderForUmpire}
                    dataKey="name"
                    type='stacked'
                    series={[{
                        name: 'Average Ladder Position',
                        color: '#CC0000'
                    }]}
                    tickLine="y"
                />
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Average Ladder Delta Position of Game</Title>
                <Text my={5} ta="center" c="dimmed" fs="italic">Lower is better</Text>
                <BarChart
                    h={300}
                    data={averageLadderDeltaForUmpire}
                    dataKey="name"
                    type='stacked'
                    series={[{
                        name: 'Average Ladder Delta',
                        color: '#CC0000'
                    }]}
                    tickLine="y"
                />
            </Grid.Col>
        </Grid></>
}