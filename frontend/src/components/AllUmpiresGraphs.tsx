import {useEffect, useMemo, useState} from "react";
import {Competition, Official, SERVER_ADDRESS, StatsForUmpire} from "@/serverTypes";
import {COLORS, defs} from "./IndividualGraph";
import {Grid, Group, Select, Title, Text} from "@mantine/core";
import {AreaChart, BarChart, PieChart } from "@mantine/charts";
import {addOtherFieldToGraph} from "@/graphUtils";

interface AllUmpiresGraphsParams {
    fromYear: number;
    toYear: number;
    grade: string;
    allUmpires: Official[]
}

export function AllUmpiresGraphs({fromYear, toYear, grade, allUmpires}: AllUmpiresGraphsParams) {
    const [perUmpireStats, setPerUmpireStats] = useState<StatsForUmpire[]>([])
    const [viewAsPieChart, setViewAsPieChart] = useState<boolean>(true);

    const relevantUmpires =
        useMemo(() =>
            allUmpires.filter(it => perUmpireStats?.map(it => it.umpire.name)?.includes(it.name) ?? true).map((it, i) => ({
                ...it,
                color: COLORS[i % COLORS.length]
            })) ?? [], [allUmpires, perUmpireStats])
    
    const [perWeekStats, setPerWeekStats] = useState<{
        [key: string]: { [key: string]: number }
    }>({})
    const [perEmailProviderStats, setPerEmailProviderStats] = useState<({
        emailProvider: string,
        umpires: number,
        gamesUmpired: number
    } & { color: string })[]>([])

    const gamesTillRelevant = Math.round(1.5 * (1 + toYear - fromYear))

    const umpiresByName = useMemo(() => Object.fromEntries(relevantUmpires.map(it => [it.name, it])), [relevantUmpires])


    useEffect(() => {
        if (!toYear || !fromYear) return
        setPerUmpireStats([])
        setPerEmailProviderStats([])
        setPerWeekStats({})
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
    })).sort((a, b) => a.value - b.value)


    const gamesPerUmpirePerYear = perUmpireStats?.map(it => ({
        name: it.umpire.name,
        value: Math.round(100 * it.gamesUmpired / it.yearsUmpired.length) / 100,
        color: umpiresByName[it.umpire.name]?.color ?? 'pink'
    })).sort((a, b) => a.value - b.value)

    const gamesPerEmailProvider = perEmailProviderStats?.map((it, i) => ({
        name: it.emailProvider,
        value: it.gamesUmpired,
        color: COLORS[i % COLORS.length]
    })).sort((a, b) => a.value - b.value);

    const avgGamesPerEmailProvider = perEmailProviderStats?.map((it, i) => ({
        name: it.emailProvider,
        value: Math.round(it.gamesUmpired / it.umpires * 100) / 100,
        color: COLORS[i % COLORS.length]
    })).sort((a, b) => a.value - b.value);

    const avgGamesPerWeek = perUmpireStats?.map(it => ({
        name: it.umpire.name,
        value: it.averageGamesPerWeek,
        color: umpiresByName[it.umpire.name]?.color ?? 'pink'
    })).sort((a, b) => a.value - b.value)

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
                if (umpiresByName[ump]?.gender === 'M') {
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


    const averageLadderForUmpire = perUmpireStats?.filter(it => it.gamesUmpired >= gamesTillRelevant && it.averageLadderPosition > 0)
        .map(it => ({
            name: it.umpire.name,
            value: it.averageLadderPosition,
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).sort((a, b) => a.value - b.value);

    const averageLadderDeltaForUmpire = perUmpireStats?.filter(it => it.gamesUmpired >= gamesTillRelevant && it.averageLadderPosition > 0)
        .map(it => ({
            name: it.umpire.name,
            value: it.averageLadderDifference,
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).sort((a, b) => a.value - b.value);

    const averageScoreDeltaForUmpire = perUmpireStats?.filter(it => it.gamesUmpired >= gamesTillRelevant)
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
        <Grid w="100%" gap={3} p={20}>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games Umpired</Title>
                <Text onClick={() => setViewAsPieChart(!viewAsPieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {viewAsPieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {viewAsPieChart ?
                    <PieChart data={addOtherFieldToGraph(gamesPerUmpire, 0)} withTooltip tooltipDataSource="segment" mx="auto"
                              size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={addOtherFieldToGraph(gamesPerUmpire, 0)}
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
            {toYear === fromYear && <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Weekly Games</Title>
                {['all', 'premier'].includes(grade.toLowerCase()) &&
                    <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired {gamesTillRelevant}+
                        games</Text>}
                <BarChart data={gamesPerWeek} withTooltip mx="auto" type="percent"
                          h={300}
                          dataKey="week"
                          series={relevantUmpires.map(it => ({color: it.color, name: it.name}))}
                >{defs}</BarChart>
            </Grid.Col>}
            {toYear !== fromYear && <>
                <Grid.Col span={{base: 12, md: 3}} p={10}>
                    <Title order={3} ta="center">Average Games Umpired per Week</Title>
                    <Text onClick={() => setViewAsPieChart(!viewAsPieChart)} my={5} ta="center" c="dimmed" fs="italic"
                          style={{textDecoration: 'underline'}}>
                        View as {viewAsPieChart ? 'Bar' : 'Pie'} Chart
                    </Text>

                    {viewAsPieChart ?
                        <PieChart data={addOtherFieldToGraph(avgGamesPerWeek, 0, true)} withTooltip tooltipDataSource="segment"
                                  mx="auto" size={250}
                                  startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                        <BarChart data={addOtherFieldToGraph(avgGamesPerWeek, 0, true)}
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
                </Grid.Col><Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Average Games per Year</Title>
                {viewAsPieChart ?
                    <PieChart data={addOtherFieldToGraph(gamesPerUmpirePerYear, 0, true)} withTooltip
                              tooltipDataSource="segment"
                              mx="auto" size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={addOtherFieldToGraph(gamesPerUmpirePerYear, 0, true)}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Games Umpired Per Year', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: gamesPerUmpirePerYear.map(it => it.value).reduce((a, b) => a + b, 0) / gamesPerUmpirePerYear.length,
                                      color: 'dimmed',
                                      label: 'Average',
                                      labelPosition: 'insideTopLeft',
                                  },
                              ]}></BarChart>
                }
            </Grid.Col></>}
            <Grid.Col span={{base: 12, md: 3}} p={10}>
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
            <Grid.Col span={{base: 12, md: 3}} p={10}>
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
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Average Ladder Position of Game</Title>
                <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired {gamesTillRelevant}+
                    games</Text>
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
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Average Ladder Difference of Game</Title>
                <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired {gamesTillRelevant}+
                    games</Text>
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
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Average Score Difference of Game</Title>
                <Text my={5} ta="center" c="dimmed" fs="italic">For people who have umpired {gamesTillRelevant}+
                    games</Text>
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
            {/*Coaching data only begins in 2026*/}
            {toYear >= 2026 &&
                <>
                    <Grid.Col span={{base: 12, md: 3}} p={10}>
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
                    <Grid.Col span={{base: 12, md: 3}} p={10}>
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
                </>
            }
            <Grid.Col span={{base: 12, md: 3}} p={10}>
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
            <Grid.Col span={{base: 12, md: 3}} p={10}>
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