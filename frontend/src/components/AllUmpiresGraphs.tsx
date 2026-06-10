import {Dispatch, SetStateAction, useMemo} from "react";
import {Competition, UmpireStatsResponse} from "@/serverTypes";
import {Grid, Text, Title} from "@mantine/core";
import {AreaChart, BarChart, PieChart} from "@mantine/charts";
import {addOtherFieldToGraph, COLORS, defs, OTHER_COLOR} from "@/graphUtils";
import {AllGrades} from "@/components/pages/StatisticsPage";
import {colorFromCardType} from "@/components/UmpireGraph";


interface AllUmpiresGraphsParams {
    fromYear: number;
    toYear: number;
    level: AllGrades;
    gender: 'M' | 'F' | '-';
    umpireData: UmpireStatsResponse[];
    pieChart: boolean;
    setPieChart: Dispatch<SetStateAction<boolean>>;
}

export function levelComparer(level: AllGrades, comp: Competition) {
    if (level === 'All') return true
    if (level === 'Premier') return comp.isPremier
    return level === comp.level
}

type PerWeekKey = { games: number, cards: { [color: string]: number }, cardsPerGame: { [color: string]: number } };

export function AllUmpiresGraphs({
                                     fromYear,
                                     toYear,
                                     level,
                                     gender,
                                     umpireData,
                                     pieChart,
                                     setPieChart
                                 }: AllUmpiresGraphsParams) {

    const relevantUmpireData = useMemo(() => umpireData.filter(it => it.umpireStats), [umpireData])

    const relevantUmpires = useMemo(() =>
            relevantUmpireData.filter(it =>
                it.umpireStats.competitions.filter(c =>
                    fromYear <= c.year && c.year <= toYear && levelComparer(level, c) && (gender === '-' || c.gender === gender)
                ).length
            ).map((it, i) => ({
                ...(it.umpire),
                color: COLORS[i % COLORS.length]
            })) ?? [],
        [fromYear, gender, level, relevantUmpireData, toYear]
    )

    const gamesTillRelevant = Math.round(1.5 * (1 + toYear - fromYear))

    const umpiresByName = useMemo(() => Object.fromEntries(relevantUmpires.map(it => [it.name, it])), [relevantUmpires])

    const gamesPerUmpire = relevantUmpireData?.map(it => ({
        name: it.umpire.name,
        value: it.umpireStats.games,
        color: umpiresByName[it.umpire.name]?.color ?? 'pink'
    })).sort((a, b) => a.value - b.value)


    const gamesPerUmpirePerYear = relevantUmpireData?.map(it => ({
        name: it.umpire.name,
        value: Math.round(100 * it.umpireStats.games / it.umpireStats.years.length) / 100,
        color: umpiresByName[it.umpire.name]?.color ?? 'pink'
    })).sort((a, b) => a.value - b.value)


    const avgGamesPerWeek = relevantUmpireData?.map(it => ({
        name: it.umpire.name,
        value: it.umpireStats.averageGamesPerWeek,
        color: umpiresByName[it.umpire.name]?.color ?? 'pink'
    })).sort((a, b) => a.value - b.value)

    const totalGames = relevantUmpireData.reduce((a, b) => a + b.umpireStats.games, 0)
    const gamesByMen = Math.round(100 * relevantUmpireData?.filter(it => it.umpire.gender === 'M').reduce((a, b) => a + b.umpireStats.games, 0) / totalGames)

    const perWeekData = useMemo(() =>
        Object.values(relevantUmpireData.reduce(
            (acc, it) => {
                Object.entries(it.umpireStats.gamesEveryWeek).forEach(([epoch, value]) => {
                        if (value === 0) return;
                        const key = +epoch;
                        acc[key] =
                            Object.assign({}, acc[key] ?? {week: key}, {
                                [it.umpire.name]: {
                                    games: value,
                                    cards: it.umpireStats.cardsEveryWeek[epoch],
                                    cardsPerGame: it.umpireStats.cardsEveryWeek[epoch]
                                }
                            })
                    }
                )
                return acc
            }, {} as {
                [key: string]: {
                    week: number,
                    [key: string]: PerWeekKey | number,
                }
            })).sort((a, b) => a.week - b.week).map(it => ({
            ...it,
            week: new Date(it.week).toLocaleDateString()
        } as {
            week: string, [key: string]: PerWeekKey | string
        })), [relevantUmpireData]);

    console.log(perWeekData)

    const filteredGamesPerWeek = useMemo(() => (level === 'All' || (gender === '-' && level === 'Premier')) ?
            perWeekData.map(it => Object.assign({week: it.week}, addOtherFieldToGraph(Object.fromEntries(Object.entries(it).filter(([k]) => k !== 'week').map(([k, v]) => [k, (v as PerWeekKey).games])) as {
                [key: string]: number
            }, 0, false, 2)))
            : perWeekData.map(it => Object.assign({week: it.week}, it.games))
        // we don't want this to recalculate twice for performance reasons.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        , [perWeekData])

    const gamesPerGenderPerWeek = useMemo(() => {
        const out: { 'Games Umpired by Women': number, 'Games Umpired by Men': number, week: string }[] = []
        for (const it of perWeekData) {
            const week = it.week
            const toAdd = {week, 'Games Umpired by Women': 0, 'Games Umpired by Men': 0}
            for (const [name, value] of Object.entries(it)) {
                if (name === 'week') continue;
                if (umpiresByName[name]?.gender === 'M') {
                    toAdd['Games Umpired by Men'] += (value as PerWeekKey).games
                } else {
                    toAdd['Games Umpired by Women'] += (value as PerWeekKey).games
                }
            }
            out.push(toAdd)
        }
        return out
    }, [perWeekData, umpiresByName])

    const cardsPerWeek = useMemo(() => {
        const out: { [color: string]: number | string, week: string }[] = []
        for (const it of perWeekData) {
            const week = it.week
            const toAdd: { [color: string]: number | string, week: string } = {week}
            for (const [name, value] of Object.entries(it)) {
                if (name === 'week') continue;
                for (const [color, count] of Object.entries((value as PerWeekKey).cards)) {
                    if (!(color in toAdd)) {
                        toAdd[color] = 0
                    }
                    (toAdd[color] as number) += count as number
                }
            }
            out.push(toAdd)
        }
        return out
    }, [perWeekData])

    const cardsPerGamePerWeek = useMemo(() => {
        const out: { [color: string]: number | string, week: string }[] = []
        for (const it of perWeekData) {
            const week = it.week
            const toAdd: { [color: string]: number | string, week: string, count: number } = {week, count: 0}
            for (const [name, value] of Object.entries(it)) {
                if (name === 'week') continue;
                for (const [color, count] of Object.entries((value as PerWeekKey).cardsPerGame)) {
                    if (!(color in toAdd)) {
                        toAdd[color] = 0
                    }
                    toAdd.count += 1;
                    (toAdd[color] as number) += count as number
                }
            }

            out.push(Object.fromEntries(Object.entries(toAdd).filter(([k]) => k !== 'games').map(([k, v]) => k === 'week' ? [k, v] : [k, Math.round(100 * (v as number) / toAdd.count) / 100])) as {
                [color: string]: number | string,
                week: string
            })
        }
        return out
    }, [perWeekData])


    const cumulativeGamesPerGender = useMemo(() => {
        const out: { 'Games Umpired by Women': 0, 'Games Umpired by Men': 0, week: string }[] = []
        const accumulator: { 'Games Umpired by Women': 0, 'Games Umpired by Men': 0 } = {
            'Games Umpired by Women': 0,
            'Games Umpired by Men': 0
        }
        for (const it of perWeekData) { //should theoretically be in order
            const week = it.week
            for (const [name, value] of Object.entries(it)) {
                if (name === 'week') continue;

                if (umpiresByName[name]?.gender === 'M') {
                    accumulator['Games Umpired by Men'] += (value as PerWeekKey).games
                } else {
                    accumulator['Games Umpired by Women'] += (value as PerWeekKey).games
                }
            }
            out.push({...accumulator, week})
        }
        return out;
    }, [perWeekData, umpiresByName])


    const averageLadderForUmpire = relevantUmpireData?.filter(it => it.umpireStats.games >= gamesTillRelevant && it.umpireStats.averageLadderPosition > 0)
        .map(it => ({
            name: it.umpire.name,
            value: it.umpireStats.averageLadderPosition,
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).sort((a, b) => a.value - b.value);

    const averageLadderDeltaForUmpire = relevantUmpireData?.filter(it => it.umpireStats.games >= gamesTillRelevant && it.umpireStats.averageLadderPosition > 0)
        .map(it => ({
            name: it.umpire.name,
            value: it.umpireStats.averageLadderDifference,
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).sort((a, b) => a.value - b.value);

    const cardsPerUmpire = relevantUmpireData
        ?.map(it => ({
            name: it.umpire.name,
            value: Object.values(it.umpireStats.cards).reduce((a, b) => a + b, 0),
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).sort((a, b) => a.value - b.value);

    const cardsPerUmpirePerGame = relevantUmpireData
        ?.map(it => ({
            name: it.umpire.name,
            value: Math.round(Object.values(it.umpireStats.cards).reduce((a, b) => a + b, 0) / it.umpireStats.games * 100) / 100,
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).sort((a, b) => a.value - b.value);

    const averageScoreDeltaForUmpire = relevantUmpireData?.filter(it => it.umpireStats.games >= gamesTillRelevant)
        .map(it => ({
            name: it.umpire.name,
            value: it.umpireStats.averageScoreDifference,
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).sort((a, b) => a.value - b.value);

    const umpireManagedGames = relevantUmpireData?.map(
        it => ({
            name: it.umpire.name,
            value: Object.values(it?.umpireStats.gamesWithUmpireManagers ?? {}).reduce((a, b) => a + b, 0),
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).filter(it => it.value > 0).sort((a, b) => a.value - b.value);

    const percentUmpireManagedGames = relevantUmpireData?.map(
        it => ({
            name: it.umpire.name,
            value: Math.round(100 * Object.values(it?.umpireStats.gamesWithUmpireManagers ?? {}).reduce((a, b) => a + b, 0) / it.umpireStats.games),
            color: umpiresByName[it.umpire.name]?.color ?? 'pink'
        })).filter(it => it.value > 0).sort((a, b) => a.value - b.value);

    return <>
        <Grid w="100%" gap={3} p={20}>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games Umpired</Title>
                <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {pieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {pieChart ?
                    <PieChart data={addOtherFieldToGraph(gamesPerUmpire, 0)} withTooltip tooltipDataSource="segment"
                              mx="auto"
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
                              ]}>{defs}</BarChart>
                }
            </Grid.Col>
            {toYear === fromYear ? <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Weekly Games</Title>
                <BarChart data={filteredGamesPerWeek} withTooltip mx="auto" type="stacked"
                          h={300}
                          dataKey="week"
                          series={[{
                              name: 'Other',
                              color: OTHER_COLOR
                          }, ...relevantUmpires.map(it => ({color: it.color, name: it.name}))]}
                >{defs}</BarChart>
            </Grid.Col> : <>
                <Grid.Col span={{base: 12, md: 3}} p={10}>
                    <Title order={3} ta="center">Average Games Umpired per Week</Title>
                    <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                          style={{textDecoration: 'underline'}}>
                        View as {pieChart ? 'Bar' : 'Pie'} Chart
                    </Text>

                    {pieChart ?
                        <PieChart data={addOtherFieldToGraph(avgGamesPerWeek, 0, true)} withTooltip
                                  tooltipDataSource="segment"
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
                                  ]}>{defs}</BarChart>
                    }
                </Grid.Col>
                <Grid.Col span={{base: 12, md: 3}} p={10}>
                    <Title order={3} ta="center">Average Games per Year</Title>
                    {pieChart ?
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
                                  ]}>{defs}</BarChart>
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
                <Title order={3} ta="center">Weekly Games by Gender</Title>
                <AreaChart data={gamesPerGenderPerWeek}
                           withGradient={false}
                           h={300}
                           type="percent"
                           withTooltip
                           dotProps={{r: 0, strokeWidth: 0}}
                           mx="auto"
                           series={[
                               {name: 'Games Umpired by Women', color: '#de47de'},
                               {name: 'Games Umpired by Men', color: '#5555ee'}
                           ]}
                           dataKey="week"
                           curveType="linear">
                    {defs}
                </AreaChart>
            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Cumulative Gender Split over Time</Title>
                <AreaChart data={cumulativeGamesPerGender}
                           withGradient={false}
                           h={300}
                           type="percent"
                           withTooltip
                           dotProps={{r: 0, strokeWidth: 0}}
                           mx="auto"
                           series={[
                               {name: 'Games Umpired by Women', color: '#de47de'},
                               {name: 'Games Umpired by Men', color: '#5555ee'}
                           ]}
                           dataKey="week"
                           curveType="linear">
                    {defs}
                </AreaChart>
            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Cards Given by Umpire</Title>
                <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {pieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {pieChart ?
                    <PieChart data={addOtherFieldToGraph(cardsPerUmpire, 0, false)} withTooltip
                              tooltipDataSource="segment"
                              mx="auto" size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={addOtherFieldToGraph(cardsPerUmpire, 0, false)}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Cards Given', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: cardsPerUmpire.map(it => it.value).reduce((a, b) => a + b, 0) / cardsPerUmpire.length,
                                      color: 'dimmed',
                                      label: 'Average',
                                      labelPosition: 'insideTopLeft',
                                  },
                              ]}>{defs}</BarChart>
                }
            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Average Cards Given by Umpire per Game</Title>
                <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {pieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {pieChart ?
                    <PieChart data={addOtherFieldToGraph(cardsPerUmpirePerGame, 0, true)} withTooltip
                              tooltipDataSource="segment"
                              mx="auto" size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={addOtherFieldToGraph(cardsPerUmpirePerGame, 0, true)}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Cards Given', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: cardsPerUmpirePerGame.map(it => it.value).reduce((a, b) => a + b, 0) / cardsPerUmpirePerGame.length,
                                      color: 'dimmed',
                                      label: 'Average',
                                      labelPosition: 'insideTopLeft',
                                  },
                              ]}>{defs}</BarChart>
                }
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
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Cards Per Week</Title>
                <BarChart
                    h={300}
                    data={cardsPerWeek}
                    dataKey="week"
                    type='stacked'
                    series={[{
                        name: 'G',
                        label: 'Green Cards',
                        color: colorFromCardType('G')
                    }, {
                        name: 'Y',
                        label: 'Yellow Cards',
                        color: colorFromCardType('Y')
                    }, {
                        name: '10Y',
                        label: '10 Minute Yellow',
                        color: colorFromCardType('10')
                    }, {
                        name: 'R',
                        label: 'Red Cards',
                        color: colorFromCardType('R')
                    }]}
                    tickLine="y"
                >{defs}</BarChart>
            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Cards Per Game Week</Title>
                <BarChart
                    h={300}
                    data={cardsPerGamePerWeek}
                    dataKey="week"
                    type='stacked'
                    series={[{
                        name: 'G',
                        label: 'Green Cards',
                        color: colorFromCardType('G')
                    }, {
                        name: 'Y',
                        label: 'Yellow Cards',
                        color: colorFromCardType('Y')
                    }, {
                        name: '10Y',
                        label: '10 Minute Yellow',
                        color: colorFromCardType('10')
                    }, {
                        name: 'R',
                        label: 'Red Cards',
                        color: colorFromCardType('R')
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
        </Grid></>
}