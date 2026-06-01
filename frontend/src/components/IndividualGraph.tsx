'use client'

import {AreaChart, BarChart, PieChart} from "@mantine/charts";
import {Grid, Group, Select, Text, Title} from "@mantine/core";
import {useEffect, useMemo, useState, Fragment} from "react";
import {Competition, Official, SERVER_ADDRESS} from "@/serverTypes";

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
    '#ffffff',
    '#64609A',
    '#FF9966',
    '#A57164',
    '#004225'

]
export const COLORS = BASE_COLORS
    .concat(BASE_COLORS.map((_, i) => `url(#diagonal${i})`))
    .concat(BASE_COLORS.map((_, i) => `url(#checkers${i})`))
    .concat(BASE_COLORS.map((_, i) => `url(#dots${i})`));


export const defs = <defs>
    {BASE_COLORS.map((color, i) =>
        <Fragment key={i}>
            <pattern
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
            <pattern id={`checkers${i}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)scale(0.5)">
                <rect x="0" width="10" height="10" y="0" fill={color}></rect>
                <rect x="10" width="10" height="10" y="10" fill={color}></rect>
            </pattern>
            <pattern id={`dots${i}`} width={20} height={20} patternTransform="rotate(45)scale(0.5)"
                     patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#2b2b31"/>
                <path fill={color} d="M11 6a5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5 5 5 0 0 1 5 5"/>
            </pattern>

        </Fragment>
    )}
</defs>

interface IndividualGraphProps {
    name: string;
}

export function IndividualGraph({name}: IndividualGraphProps) {
    const [viewAsPieChart, setViewAsPieChart] = useState<boolean>(true);
    const [year, setYear] = useState<string>(new Date().getFullYear().toString());
    const [grade, setGrade] = useState<string>('All')
    const [umpires, setUmpires] = useState<(Official & { color: string })[]>([])
    const [gradesInYears, setGradesInYears] = useState<{
        [year: string]: string[]
    }>({'All': ['Prem One Men', 'Prem One Women', 'Prem Two Men', 'Prem Two Women']})
    const [perWeekStats, setPerWeekStats] = useState<{
        [key: string]: { [key: string]: number }
    }>({})
    const [perUmpireStats, setPerUmpireStats] = useState<{
        umpire: Official,
        gamesUmpired: number,
        averageGamesPerWeek: number,
        gamesUmpiredPerVenue: { [key: string]: number }
        gamesUmpiredEveryWeek: { [key: string]: number }
        color: string
    }[]>([])

    const umpiresByName = useMemo(() => Object.fromEntries(umpires.map(it => [it.name, it])), [umpires])

    useEffect(() => {
        fetch(`${SERVER_ADDRESS}/api/appointments/available`).then(res => res.json()).then((comps: Competition[]) => {
            const out: { [key: string]: string[] } = {}
            for (const comp of comps) {
                const key = comp.year.toString();
                if (!(key in out)) {
                    out[key] = []
                }
                out[key].push(`${comp.level} ${comp.gender === 'M' ? 'Men' : 'Women'}`)
            }
            setGradesInYears(prev => Object.assign(prev, out))
        });
        fetch(`${SERVER_ADDRESS}/api/appointments/umpires`).then(res => res.json())
            .then(it => {
                setUmpires(it.umpires.map((it: any, i: number) => ({...it, color: COLORS[i % COLORS.length]})))
            })
    }, []);

    useEffect(() => {
        if (!name) return;
        const per_ump_url = new URL(`${SERVER_ADDRESS}/api/appointments/per_umpire_stats`)
        const per_week_url = new URL(`${SERVER_ADDRESS}/api/appointments/per_week_stats`)
        per_ump_url.searchParams.set('umpire', name.toString())
        if (year !== 'All') {
            per_ump_url.searchParams.set('year', year.toString())
            per_week_url.searchParams.set('year', year.toString())
        }
        if (grade !== 'All') {
            per_ump_url.searchParams.set('level', grade.replace(/\s\S*$/, ''))
            per_ump_url.searchParams.set('gender', grade.toLowerCase().includes('women') ? 'F' : 'M')

            per_week_url.searchParams.set('level', grade.replace(/\s\S*$/, ''))
            per_week_url.searchParams.set('gender', grade.toLowerCase().includes('women') ? 'F' : 'M')
        }
        let cancelled = false;
        fetch(per_ump_url)
            .then(it => it.json())
            .then(it => {
                if (!cancelled) {
                    setPerUmpireStats(it.statistic)
                }
            })
        fetch(per_week_url)
            .then(it => it.json())
            .then(it => {
                if (!cancelled) {
                    setPerWeekStats(it.statistic)
                }
            })
        return () => {
            cancelled = true
        }
    }, [grade, name, year]);


    const gamesPerUmpire = perUmpireStats?.map(it => ({
        name: it.umpire.name,
        value: it.gamesUmpired,
        color: umpiresByName[it.umpire.name].color
    })).sort((a, b) => a.value - b.value);
    console.log(gamesPerUmpire)
    const avgGamesPerWeek = perUmpireStats?.map(it => ({
        name: it.umpire.name,
        value: it.averageGamesPerWeek,
        color: umpiresByName[it.umpire.name].color
    })).sort((a, b) => a.value - b.value);

    const totalGames = perUmpireStats.reduce((a, b) => a + b.gamesUmpired, 0)
    const gamesByMen = Math.round(100 * perUmpireStats?.filter(it => it.umpire.gender === 'M').reduce((a, b) => a + b.gamesUmpired, 0) / totalGames)

    const gamesPerWeek = useMemo(() => {
        let ret: { [key: string]: number | string }[] = Object.entries(perWeekStats).map(([k, v]) => ({
            ...v,
            week: new Date(+k).toDateString()
        }));
        if (grade === 'All' || !year) {
            ret = ret.map(it => Object.fromEntries(Object.entries(it).filter(([k, v]) => k === 'week' || (v as number) > 1)))
        }
        return ret
    }, [perWeekStats])

    const gamesPerGenderPerWeek = useMemo(() => {
        const out: { [key: string]: { male: 0, total: 0 } } = {}
        for (const [week, umpires] of Object.entries(perWeekStats)) {
            for (const [ump, count] of Object.entries(umpires)) {
                const key = new Date(+week).toDateString()
                if (!(key in out)) {
                    out[key] = {male: 0, total: 0}
                }
                out[key].total += count
                if (umpiresByName[ump].gender === 'M') {
                    out[key].male += count
                }
            }
        }
        return Object.entries(out).map(([k, v]) => ({
            week: k,
            '% Games Umpired by Women': 100 - Math.round(100 * v.male / v.total),
            '% Games Umpired by Men': Math.round(100 * v.male / v.total)
        }));
    }, [umpiresByName, perWeekStats])


    return <>

        <Group w="100%" justify="center">
            <Title ta="center" m={20}>Graphs For</Title>
            <Select w={200} defaultValue="All"
                    data={[...(gradesInYears[year] ?? []), 'All']}
                    value={grade}
                    onChange={it => setGrade(it!)}/>
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
                <Title order={3} ta="center">Average Games Umpired per Week</Title>
                <Text onClick={() => setViewAsPieChart(!viewAsPieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {viewAsPieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {viewAsPieChart ?
                    <PieChart data={avgGamesPerWeek} withTooltip tooltipDataSource="segment" mx="auto" size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={avgGamesPerWeek}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Games Umpired', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: avgGamesPerWeek.map(it => it.value).reduce((a, b) => a + b, 0) / avgGamesPerWeek.length,
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
                <BarChart data={year === 'All' ? [] : gamesPerWeek} withTooltip mx="auto" type="percent"
                          h={300}
                          dataKey="week"
                          series={umpires.map(it => ({color: it.color, name: it.name}))}
                >{defs}</BarChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Games by Gender</Title>
                <PieChart data={[{
                    name: 'Percentage Umpired by Men',
                    value: gamesByMen,
                    color: '#5555ee'
                }, {name: 'Percentage Umpired by Women', value: 100 - gamesByMen, color: '#de47de'}]}
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
                           mx="auto"
                           series={[
                               {name: '% Games Umpired by Women', color: '#de47de'},
                               {name: '% Games Umpired by Men', color: '#5555ee'}
                           ]}
                           dataKey="week"
                           curveType="linear">
                    {defs}
                </AreaChart>
            </Grid.Col>
            {/*<Grid.Col span={{base: 6, md: 3}} p={10}>*/}
            {/*    <Title order={3} ta="center">Average Ladder Position of Game</Title>*/}
            {/*    <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired 2+ games</Text>*/}
            {/*    <BarChart*/}
            {/*        h={300}*/}
            {/*        referenceLines={[*/}
            {/*            {*/}
            {/*                y: averageLadderForUmpire.map(it => it["Average Ladder Position"]).reduce((a, b) => a + b, 0) / averageLadderForUmpire.length,*/}
            {/*                color: 'dimmed',*/}
            {/*                label: 'Average',*/}
            {/*                labelPosition: 'insideTopLeft',*/}
            {/*            },*/}
            {/*        ]}*/}
            {/*        data={averageLadderForUmpire}*/}
            {/*        dataKey="name"*/}
            {/*        type='stacked'*/}
            {/*        series={[{*/}
            {/*            name: 'Average Ladder Position',*/}
            {/*        }]}*/}
            {/*        tickLine="y"*/}
            {/*    >{defs}</BarChart>*/}
            {/*</Grid.Col>*/}
            {/*<Grid.Col span={{base: 6, md: 3}} p={10}>*/}
            {/*    <Title order={3} ta="center">Average Ladder Delta Position of Game</Title>*/}
            {/*    <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired 2+ games</Text>*/}
            {/*    <BarChart*/}
            {/*        h={300}*/}
            {/*        referenceLines={[*/}
            {/*            {*/}
            {/*                y: averageLadderDeltaForUmpire.map(it => it["Average Ladder Delta"]).reduce((a, b) => a + b, 0) / averageLadderDeltaForUmpire.length,*/}
            {/*                color: 'dimmed',*/}
            {/*                label: 'Average',*/}
            {/*                labelPosition: 'insideTopLeft',*/}
            {/*            },*/}
            {/*        ]}*/}

            {/*        data={averageLadderDeltaForUmpire}*/}
            {/*        dataKey="name"*/}
            {/*        type='stacked'*/}
            {/*        series={[{*/}
            {/*            name: 'Average Ladder Delta',*/}
            {/*        }]}*/}
            {/*        tickLine="y"*/}
            {/*    >{defs}</BarChart>*/}
            {/*</Grid.Col>*/}
        </Grid></>
}