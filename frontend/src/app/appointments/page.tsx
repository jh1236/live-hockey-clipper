'use client'

import {AreaChart, BarChart, PieChart} from "@mantine/charts";
import {Grid, Group, Select, Title, Text} from "@mantine/core";
import {useEffect, useMemo, useState} from "react";
import {getMonday} from "@/utils";
import {Game, SERVER_ADDRESS} from "@/serverTypes";

const BASE_COLORS = [
    '#e6194b',
    '#3cb44b',
    '#ffe119',
    '#4363d8',
    '#f66700',
    '#911eb4',
    '#46f0f0',
    '#f032e6',
    '#bcf60c',
    '#fabebe',
    '#008080',
    '#e6beff',
    '#734a16',
    '#fffac8',
    '#800000',
    '#aaffc3',
    '#808000',
    '#ffd8b1',
    '#000075',
    '#808080',
    '#ffffff',
    '#64609A',
    '#FF9966',
    '#FAE7B5',
    '#A57164',
    '#004225'

]
const COLORS = BASE_COLORS.concat(BASE_COLORS.map((_, i) => `url(#diagonal${i})`))

export default function Page() {
    const [viewAsPieChart, setViewAsPieChart] = useState<boolean>(true);
    const [year, setYear] = useState<string>(new Date().getFullYear().toString());
    const [gradesInYears, setGradesInYears] = useState<{
        [year: string]: string[]
    }>({'All': ['Premier One Men', 'Premier One Women', 'Premier Two Men', 'Premier Two Women']})
    const [ladders, setLadders] = useState<{ [tournament: string]: string[] }>({});
    const [allTimeData, setAllTimeData] = useState<{ [key: string]: Game[] }>({})
    const data = useMemo(() => allTimeData[year] ?? [], [allTimeData, year]);
    const [genders, setGenders] = useState<{ [key: string]: 'M' | 'F' }>({});
    const [grade, setGrade] = useState<string | null>(null);
    useEffect(() => {
        fetch(`${SERVER_ADDRESS}/api/appointments/available`).then(res => res.json()).then(it => setGradesInYears(prev => Object.assign(prev, it)));
        fetch(`${SERVER_ADDRESS}/api/umpires/genders`).then(res => res.json()).then(setGenders);
    }, []);

    useEffect(() => {
        if (year.toString() in allTimeData) return;
        const yearToFetch = year
        fetch(`${SERVER_ADDRESS}/api/appointments?year=${yearToFetch}`).then(res => res.json()).then(it => {
                if (!(year.toString() in allTimeData)) {
                    setAllTimeData(prev => ({...prev, [yearToFetch.toString()]: it}))
                }
            }
        );
        fetch(`${SERVER_ADDRESS}/api/appointments/ladder?year=${yearToFetch}`).then(res => res.json()).then(it => {
                setLadders(prev => Object.assign(prev, it))
            }
        );
        // if we fulfil the exhaustive deps, then the code will run when we update all time data (which is useless)
        // eslint-disable-next-line
    }, [year]);
    const umpires = useMemo(() => data.flatMap(it => it.officials)
        .filter((v, i, arr) => arr.indexOf(v) === i), [data])
    const grades = useMemo(() => data.map(it => it.competition.level)
        .filter((v, i, arr) => arr.indexOf(v) === i).sort(), [data])

    const gradeData = useMemo(() =>
            !grade ? data : data.filter(it => `${it.competition.level} ${it.competition.gender === 'M' ? 'Men' : 'Women'}` === grade)
        , [data, grade])

    const officialColors = useMemo(() => Object.fromEntries(
            gradeData.flatMap(it => it.officials)
                .filter((it, i, arr) => arr.indexOf(it) === i)
                .toSorted()
                .map((it, i) => [it, COLORS[i % COLORS.length]])
        ),
        [gradeData])

    const gamesPerUmpire = useMemo(() => {
        const outMap = new Map<string, number>();
        for (const game of gradeData) {
            console.log(game);
            for (const umpire of game.officials) {
                outMap.set(umpire, (outMap.get(umpire) ?? 0) + 1)
            }
        }
        return [...outMap.entries().map(([name, value], i) => ({
            name,
            value,
            color: officialColors[name]
        }))].sort((a, b) => a.value - b.value);
    }, [gradeData, officialColors])

    const averageLadderForUmpire = useMemo(() => {
        if (!ladders) return []
        const gamesForOfficial = new Map<string, Game[]>();
        for (const game of gradeData) {
            for (const umpire of game.officials) {
                gamesForOfficial.set(umpire, [...(gamesForOfficial.get(umpire) ?? []), game])
            }
        }
        return [...gamesForOfficial.entries().filter(([, games]) => games.length > 1).map(([name, games]) => ({
            name: name,
            color: officialColors[name],
            'Average Ladder Position': Math.round(games.filter(it => it.competition.altiusId in ladders).flatMap(g => [g.homeTeam, g.awayTeam].map(t => ladders[g.competition.altiusId.toString()].indexOf(t.code) + 1)).reduce((a, b) => a + b, 0) / (2 * games.length) * 10) / 10
        }))].sort((a, b) => a['Average Ladder Position'] - b['Average Ladder Position'])

    }, [gradeData, ladders, officialColors])

    const averageLadderDeltaForUmpire = useMemo(() => {
        if (!ladders) return []
        const gamesForOfficial = new Map<string, Game[]>();
        for (const game of gradeData) {
            for (const umpire of game.officials) {
                gamesForOfficial.set(umpire, [...(gamesForOfficial.get(umpire) ?? []), game])
            }
        }
        return [...gamesForOfficial.entries().filter(([, games]) => games.length > 1).map(([name, games]) => ({
            name: name,
            color: officialColors[name],
            'Average Ladder Delta': Math.round(games.filter(it => it.competition.altiusId in ladders).flatMap(g => [g.homeTeam, g.awayTeam].map(t => ladders[g.competition.altiusId.toString()].indexOf(t.code)).reduce((a, b) => Math.abs(a - b))).reduce((a, b) => a + b, 0) / (games.length) * 10) / 10
        }))].sort((a, b) => a['Average Ladder Delta'] - b['Average Ladder Delta'])

    }, [gradeData, ladders, officialColors])

    console.log(gradeData.map(it => new Date(it.startTime).toString()))

    const gamesPerUmpirePerWeek = useMemo(() => {
        const outMap: Map<string, { [key: string]: number }> = new Map();
        for (const game of gradeData) {
            const week = getMonday(new Date(game.startTime)).toDateString();
            if (!outMap.has(week)) {
                outMap.set(week, Object.fromEntries(umpires.map(it => [it, 0])))
            }
            for (const umpire of game.officials) {
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
            ...Object.fromEntries(Object.entries(value).filter(([_, v]) => v > 0)),
        }))].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [grade, gradeData, umpires])


    const gamesPerGender = useMemo(() => {
        const outMap = {M: 0, F: 0};
        for (const game of gradeData) {
            for (const umpire of game.officials) {
                outMap[genders[umpire]] += 1
            }
        }
        return Object.entries(outMap).map(([k, v]) => ({
            name: k === 'M' ? 'Male' : 'Female',
            value: Math.round(100 * v / (gradeData.length * 2)),
            color: k === 'M' ? '#5555ee' : '#de47de'
        }));
    }, [genders, gradeData])

    const gamesPerGenderPerWeek = useMemo(() => {
        const outMap: Map<string, { games: number, women: number }> = new Map();
        for (const game of gradeData) {
            const week = getMonday(new Date(game.startTime)).toDateString();
            if (!outMap.has(week)) {
                outMap.set(week, {games: 0, women: 0});
            }
            for (const umpire of game.officials) {
                outMap.get(week)!.games += 1
                if (genders[umpire] === 'M') continue;
                outMap.get(week)!.women += 1
            }
        }
        return [...outMap.entries().map(([date, value], i) => ({
            date,
            'Percentage of Games Umpired by Women': Math.round(100 * (value.women / value.games)),
            'Percentage of Games Umpired by Men': 100 - Math.round(100 * (value.women / value.games)),
        }))].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [genders, gradeData])

    const defs = <defs>
        {BASE_COLORS.map((color, i) =>
            <pattern
                key={color}
                id={`diagonal${i}`}
                patternUnits="userSpaceOnUse"
                width={6}
                height={8}
                patternTransform="rotate(45)"
            >
                <rect
                    width="2"
                    height="8"
                    transform="translate(0,0)"
                    fill={color}
                />
            </pattern>
        )}
    </defs>

    return <>

        <Group w="100%" justify="center">
            <Title ta="center" m={20}>Graphs For</Title>
            <Select w={200} defaultValue="All" data={['All', ...grades]}
                    value={grade ?? 'All'}
                    onChange={it => setGrade((!it || it === 'All') ? null : it)}/>
            <Title ta="center" m={20}> In </Title>
            <Select w={100}
                    data={Object.keys(gradesInYears)}
                    value={year}
                    onChange={e => setYear((e ?? new Date().getFullYear()).toString())}/>
        </Group>
        <Grid w="100%" gap={3} p={20}>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Games Umpired</Title>
                <Text onClick={() => setViewAsPieChart(!viewAsPieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {viewAsPieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {viewAsPieChart ?
                    <PieChart data={gamesPerUmpire} withTooltip tooltipDataSource="segment" mx="auto" size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={gamesPerUmpire}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Games Umpired', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: gamesPerUmpire.map(it => it.value).reduce((a, b) => a + b, 0) / gamesPerUmpire.length,
                                      color: 'dimmed',
                                      label: 'Average',
                                      labelPosition: 'insideTopLeft',
                                  },
                              ]}></BarChart>
                }
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Weekly Games</Title>
                {!grade &&
                    <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired 2+ games</Text>}
                <BarChart data={gamesPerUmpirePerWeek} withTooltip mx="auto" type="percent"
                          h={300}
                          dataKey="date"
                          series={Object.entries(officialColors).map(([name, color]) => ({name, color}))}
                >{defs}</BarChart>
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
                    {defs}
                </PieChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Gender split by week</Title>
                <AreaChart data={gamesPerGenderPerWeek}
                           yAxisProps={{domain: [0, 100]}}
                           withGradient={false}
                           h={300}
                           type="stacked"
                           withTooltip
                           dotProps={{r: 0, strokeWidth: 0}}
                           mx="auto" series={[{
                    name: 'Percentage of Games Umpired by Women',
                    color: '#de47de'
                }, {name: 'Percentage of Games Umpired by Men', color: '#5555ee'}]}
                           dataKey="date" curveType="linear">
                    {defs}
                </AreaChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Average Ladder Position of Game</Title>
                <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired 2+ games</Text>
                <BarChart
                    h={300}
                    referenceLines={[
                        {
                            y: averageLadderForUmpire.map(it => it["Average Ladder Position"]).reduce((a, b) => a + b, 0) / averageLadderForUmpire.length,
                            color: 'dimmed',
                            label: 'Average',
                            labelPosition: 'insideTopLeft',
                        },
                    ]}
                    data={averageLadderForUmpire}
                    dataKey="name"
                    type='stacked'
                    series={[{
                        name: 'Average Ladder Position',
                    }]}
                    tickLine="y"
                >{defs}</BarChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Average Ladder Delta Position of Game</Title>
                <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired 2+ games</Text>
                <BarChart
                    h={300}
                    referenceLines={[
                        {
                            y: averageLadderDeltaForUmpire.map(it => it["Average Ladder Delta"]).reduce((a, b) => a + b, 0) / averageLadderDeltaForUmpire.length,
                            color: 'dimmed',
                            label: 'Average',
                            labelPosition: 'insideTopLeft',
                        },
                    ]}

                    data={averageLadderDeltaForUmpire}
                    dataKey="name"
                    type='stacked'
                    series={[{
                        name: 'Average Ladder Delta',
                    }]}
                    tickLine="y"
                >{defs}</BarChart>
            </Grid.Col>
        </Grid></>
}