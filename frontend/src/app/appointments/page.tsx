'use client'

import {AreaChart, BarChart, PieChart} from "@mantine/charts";
import {Grid, Group, Select, Text, Title} from "@mantine/core";
import {useEffect, useMemo, useState} from "react";
import {Competition, Official, SERVER_ADDRESS} from "@/serverTypes";
import {COLORS, defs} from "@/components/IndividualGraph";

interface StatsForUmpire {
    averageGamesPerWeek: number
    averageLadderDifference: number
    averageLadderPosition: number
    averageScoreDifference: number
    gamesPerTeam: { [team: string]: number }
    gamesUmpired: number
    gamesUmpiredEveryWeek: { [epoch: string]: number }
    gamesUmpiredPerVenue: { [venue: string]: number }
    gamesWithUmpireManagers: { [umpireManager: string]: number }
    umpire: Official
    yearsUmpired: number[]
}

const ORDER_GRADES = ['Prem One Men', 'Prem One Women', 'Prem Two Men', 'Prem Two Women', '11/12 Div One Boys', '11/12 Div One Girls', '9/10 Div One Boys', '9/10 Div One Girls']

export default function Page() {
    const [viewAsPieChart, setViewAsPieChart] = useState<boolean>(true);
    const [fromYear, setFromYear] = useState<number>(new Date().getFullYear());
    const [toYear, setToYear] = useState<number>(new Date().getFullYear());
    const [grade, setGrade] = useState<string>('All')
    const [umpires, setUmpires] = useState<(Official & { color: string })[]>([])
    const [gradesInYears, setGradesInYears] = useState<{
        [year: string]: string[]
    }>({'-': ['Prem One Men', 'Prem One Women', 'Prem Two Men', 'Prem Two Women', '11/12 Div One Boys', '11/12 Div One Boys', '9/10 Div One Boys', '9/10 Div One Girls']})
    const gradesInRange = useMemo(() => {
        let out = new Set();
        (gradesInYears['-']).forEach(it => {
            console.log(it)
            out.add(it)
        })
        for (const i in Array.from({length: toYear - fromYear})) {
            const year = +fromYear + (+i);
            const temp = new Set();
            (gradesInYears[year.toString()] ?? []).forEach(it => {
                console.log(it)
                temp.add(it)
            })
            out = out.intersection(temp)
        }
        return ([...out, 'All', 'Premier'] as string[]).toSorted((a, b) => ORDER_GRADES.indexOf(a) - ORDER_GRADES.indexOf(b)) as string[]
    }, [fromYear, gradesInYears, toYear])
    const [perWeekStats, setPerWeekStats] = useState<{
        [key: string]: { [key: string]: number }
    }>({})
    const [perUmpireStats, setPerUmpireStats] = useState<(StatsForUmpire & { color: string })[]>([])
    const [perEmailProviderStats, setPerEmailProviderStats] = useState<({ emailProvider: string, umpires: number, gamesUmpired: number } & { color: string })[]>([])

    const umpiresByName = useMemo(() => Object.fromEntries(umpires.map(it => [it.name, it])), [umpires])

    useEffect(() => {
        fetch(`${SERVER_ADDRESS}/api/appointments/available`).then(res => res.json()).then((comps: Competition[]) => {
            const out: { [key: string]: string[] } = {}
            for (const comp of comps) {
                const key = comp.year.toString();
                if (!(key in out)) {
                    out[key] = []
                }
                const gender = comp.ageLevel === 'Juniors' ?
                    (comp.gender === 'M' ? 'Boys' : 'Girls') :
                    (comp.gender === 'M' ? 'Men' : 'Women');
                out[key].push(`${comp.level} ${gender}`)
            }
            setGradesInYears(prev => Object.assign(prev, out))
        });
        fetch(`${SERVER_ADDRESS}/api/appointments/umpires`).then(res => res.json())
            .then(it => {
                setUmpires(it.umpires.map((it: any, i: number) => ({...it, color: COLORS[i % COLORS.length]})))
            })
    }, []);

    useEffect(() => {
        if (!toYear || !fromYear) return
        const per_ump_url = new URL(`${SERVER_ADDRESS}/api/appointments/per_umpire_stats`)
        const per_week_url = new URL(`${SERVER_ADDRESS}/api/appointments/per_week_stats`)
        const per_email_url = new URL(`${SERVER_ADDRESS}/api/appointments/per_email_provider_stats`)

        per_ump_url.searchParams.set('to_year', toYear.toString())
        per_week_url.searchParams.set('to_year', toYear.toString())
        per_email_url.searchParams.set('to_year', toYear.toString())

        per_ump_url.searchParams.set('from_year', fromYear.toString())
        per_week_url.searchParams.set('from_year', fromYear.toString())
        per_email_url.searchParams.set('from_year', fromYear.toString())


        per_ump_url.searchParams.set('level', grade.replace(/\s\S*$/, ''))
        per_week_url.searchParams.set('level', grade.replace(/\s\S*$/, ''))
        per_email_url.searchParams.set('level', grade.replace(/\s\S*$/, ''))
        if (!['all', 'premier'].includes(grade.toLowerCase())) {
            const gender = grade.toLowerCase().includes('women') || grade.toLowerCase().includes('girl');
            per_ump_url.searchParams.set('gender', gender ? 'F' : 'M')
            per_week_url.searchParams.set('gender', gender ? 'F' : 'M')
            per_email_url.searchParams.set('gender', gender ? 'F' : 'M')
        }

        let cancelled = false;
        fetch(per_ump_url)
            .then(it => it.json())
            .then(it => {
                if (!cancelled) {
                    setPerUmpireStats(it.statistic)
                }
            })
        
        fetch(per_email_url)
            .then(it => it.json())
            .then(it => {
                if (!cancelled) {
                    setPerEmailProviderStats(it.statistic)
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
    }, [fromYear, grade, toYear]);


    const gamesPerUmpire = perUmpireStats?.map(it => ({
        name: it.umpire.name,
        value: it.gamesUmpired,
        color: umpiresByName[it.umpire.name]?.color ?? 'pink'
    })).sort((a, b) => a.value - b.value);

    const gamesPerEmailProvider = perEmailProviderStats?.map((it, i) => ({
        name: it.emailProvider,
        value: it.gamesUmpired,
        color: COLORS[i % COLORS.length]
    })).sort((a, b) => a.value - b.value);

    const avgGamesPerEmailProvider = perEmailProviderStats?.map((it, i) => ({
        name: it.emailProvider,
        value: Math.round(it.gamesUmpired / it.umpires * 100)  / 100,
        color: COLORS[i % COLORS.length]
    })).sort((a, b) => a.value - b.value);

    const avgGamesPerWeek = perUmpireStats?.map(it => ({
        name: it.umpire.name,
        value: it.averageGamesPerWeek,
        color: umpiresByName[it.umpire.name]?.color ?? 'pink'
    })).sort((a, b) => a.value - b.value);

    const totalGames = perUmpireStats.reduce((a, b) => a + b.gamesUmpired, 0)
    const gamesByMen = Math.round(100 * perUmpireStats?.filter(it => it.umpire.gender === 'M').reduce((a, b) => a + b.gamesUmpired, 0) / totalGames)

    const gamesPerWeek = toYear === fromYear ? Object.entries(perWeekStats).map(([k, v]) => ({
        ...Object.fromEntries(Object.entries(v).filter(([_, v2]) => (!['all', 'premier'].includes(grade.toLowerCase())) || v2 > 1)),
        week: new Date(+k).toDateString()
    })) : [];

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


    const averageLadderForUmpire = perUmpireStats?.filter(it => it.gamesUmpired > 1)
        .map(it => ({
            name: it.umpire.name,
            value: it.averageLadderPosition,
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).sort((a, b) => a.value - b.value);

    const averageLadderDeltaForUmpire = perUmpireStats?.filter(it => it.gamesUmpired > 1)
        .map(it => ({
            name: it.umpire.name,
            value: it.averageLadderDifference,
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).sort((a, b) => a.value - b.value);

    const averageScoreDeltaForUmpire = perUmpireStats?.filter(it => it.gamesUmpired > 1)
        .map(it => ({
            name: it.umpire.name,
            value: it.averageScoreDifference,
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).sort((a, b) => a.value - b.value);

    const umpireManagedGames = perUmpireStats?.map(
        it => ({
            name: it.umpire.name,
            value: Object.values(it?.gamesWithUmpireManagers ?? {}).reduce((a, b) => a + b, 0),
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).filter(it => it.value > 0).sort((a, b) => a.value - b.value);

    const percentUmpireManagedGames = perUmpireStats?.map(
        it => ({
            name: it.umpire.name,
            value: Math.round(100 * Object.values(it?.gamesWithUmpireManagers ?? {}).reduce((a, b) => a + b, 0) / it.gamesUmpired),
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).filter(it => it.value > 0).sort((a, b) => a.value - b.value);

    return <>

        <Group w="100%" justify="center">
            <Title ta="center" m={20}>Graphs For</Title>
            <Select w={200} defaultValue="All"
                    data={gradesInRange}
                    value={grade}
                    onChange={it => setGrade(it!)}/>
            <Title ta="center" m={20}> From </Title>
            <Select w={100}
                    data={[...Object.keys(gradesInYears).filter(it => +it <= toYear), '-']}
                    value={fromYear.toString()}
                    onChange={e => {
                        if (e === null) return
                        if (e === '-') {
                            setFromYear(Object.keys(gradesInYears).reduce((a, b) => Math.min(a, +b), Number.MAX_VALUE))
                        }
                        setFromYear(+e)
                    }}/>
            <Title ta="center" m={20}> To </Title>
            <Select w={100}
                    data={[...Object.keys(gradesInYears).filter(it => +it >= fromYear), '-']}
                    value={toYear.toString()}
                    onChange={e => {
                        if (e === null) return
                        if (e === '-') {
                            setToYear(Object.keys(gradesInYears).reduce((a, b) => Math.max(a, +b), 0))
                        }
                        setToYear(+e)
                    }}/>
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
            {toYear === fromYear && <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Weekly Games</Title>
                {!grade &&
                    <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired 2+ games</Text>}
                <BarChart data={gamesPerWeek} withTooltip mx="auto" type="percent"
                          h={300}
                          dataKey="week"
                          series={umpires.map(it => ({color: it.color, name: it.name}))}
                >{defs}</BarChart>
            </Grid.Col>}
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
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Average Ladder Position of Game</Title>
                <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired 2+ games</Text>
                <BarChart
                    h={300}
                    referenceLines={[
                        {
                            y: averageLadderForUmpire.map(it => it.value).reduce((a, b) => a + b, 0) / averageLadderForUmpire.length,
                            color: 'dimmed',
                            label: 'Average',
                            labelPosition: 'insideTopLeft',
                        },
                    ]}
                    data={averageLadderForUmpire}
                    dataKey="name"
                    type='stacked'
                    series={[{
                        name: 'value',
                        label: 'Average Ladder Position'
                    }]}
                    tickLine="y"
                >{defs}</BarChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Average Ladder Difference of Game</Title>
                <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired 2+ games</Text>
                <BarChart
                    h={300}
                    referenceLines={[
                        {
                            y: averageLadderDeltaForUmpire.map(it => it.value).reduce((a, b) => a + b, 0) / averageLadderDeltaForUmpire.length,
                            color: 'dimmed',
                            label: 'Average',
                            labelPosition: 'insideTopLeft',
                        },
                    ]}

                    data={averageLadderDeltaForUmpire}
                    dataKey="name"
                    type='stacked'
                    series={[{
                        name: 'value',
                        label: 'Average Ladder Difference'
                    }]}
                    tickLine="y"
                >{defs}</BarChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Average Score Difference of Game</Title>
                <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired 2+ games</Text>
                <BarChart
                    h={300}
                    referenceLines={[
                        {
                            y: averageScoreDeltaForUmpire.map(it => it.value).reduce((a, b) => a + b, 0) / averageScoreDeltaForUmpire.length,
                            color: 'dimmed',
                            label: 'Average',
                            labelPosition: 'insideTopLeft',
                        },
                    ]}

                    data={averageScoreDeltaForUmpire}
                    dataKey="name"
                    type='stacked'
                    series={[{
                        name: 'value',
                        label: 'Average Score Difference'
                    }]}
                    tickLine="y"
                >{defs}</BarChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Amount of Games with Umpire Manager</Title>
                <BarChart
                    h={300}
                    referenceLines={[
                        {
                            y: umpireManagedGames.map(it => it.value).reduce((a, b) => a + b, 0) / averageScoreDeltaForUmpire.length,
                            color: 'dimmed',
                            label: 'Average',
                            labelPosition: 'insideTopLeft',
                        },
                    ]}

                    data={umpireManagedGames}
                    dataKey="name"
                    type='stacked'
                    series={[{
                        name: 'value',
                        label: 'Average Games UM\'d'
                    }]}
                    tickLine="y"
                >{defs}</BarChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Percentage of Games with Umpire Manager</Title>
                <BarChart
                    h={300}
                    referenceLines={[
                        {
                            y: percentUmpireManagedGames.map(it => it.value).reduce((a, b) => a + b, 0) / percentUmpireManagedGames.length,
                            color: 'dimmed',
                            label: 'Average',
                            labelPosition: 'insideTopLeft',
                        },
                    ]}

                    data={percentUmpireManagedGames}
                    dataKey="name"
                    type='stacked'
                    series={[{
                        name: 'value',
                        label: '% Games UM\'d'
                    }]}
                    tickLine="y"
                >{defs}</BarChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Games Umpired By Email Provider</Title>
                <BarChart
                    h={300}
                    referenceLines={[
                        {
                            y: gamesPerEmailProvider.map(it => it.value).reduce((a, b) => a + b, 0) / gamesPerEmailProvider.length,
                            color: 'dimmed',
                            label: 'Average',
                            labelPosition: 'insideTopLeft',
                        },
                    ]}

                    data={gamesPerEmailProvider}
                    dataKey="name"
                    type='stacked'
                    series={[{
                        name: 'value',
                        label: 'Games Umpired'
                    }]}
                    tickLine="y"
                >{defs}</BarChart>
            </Grid.Col>
            <Grid.Col span={{base: 6, md: 3}} p={10}>
                <Title order={3} ta="center">Average Games Umpired By Email Provider</Title>
                <BarChart
                    h={300}
                    referenceLines={[
                        {
                            y: avgGamesPerEmailProvider.map(it => it.value).reduce((a, b) => a + b, 0) / avgGamesPerEmailProvider.length,
                            color: 'dimmed',
                            label: 'Average',
                            labelPosition: 'insideTopLeft',
                        },
                    ]}

                    data={avgGamesPerEmailProvider}
                    dataKey="name"
                    type='stacked'
                    series={[{
                        name: 'value',
                        label: 'Average Games Umpired'
                    }]}
                    tickLine="y"
                >{defs}</BarChart>
            </Grid.Col>
        </Grid></>
}