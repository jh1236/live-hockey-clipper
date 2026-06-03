'use client'

import {AreaChart, BarChart, PieChart} from "@mantine/charts";
import {Grid, Select, Text, Title} from "@mantine/core";
import {useEffect, useMemo, useState} from "react";
import {Official, SERVER_ADDRESS, UmpireStatsResponse} from "@/serverTypes";
import {addOtherFieldToGraph, COLORS, defs, OTHER_COLOR} from "@/graphUtils";
import {levelComparer} from "@/components/AllUmpiresGraphs";
import {AllGrades} from "@/app/appointments/page";


interface UmpireMangerGraphsParams {
    fromYear: number;
    toYear: number;
    level: AllGrades;
    gender: 'M' | 'F' | '-';
    umpireData: UmpireStatsResponse[]
}


export function UmpireManagerGraphs({fromYear, toYear, level, gender, umpireData}: UmpireMangerGraphsParams) {
    const [viewAsPieChart, setViewAsPieChart] = useState<boolean>(true);

    const relevantUMData = useMemo(() => umpireData.filter(it => it.managerStats), [umpireData])

    const relevantUMs = useMemo(() =>
            relevantUMData.filter(it =>
                it.managerStats.competitions.filter(c =>
                    fromYear <= c.year && c.year <= toYear && levelComparer(level, c) && (gender === '-' || c.gender === gender)
                ).length
            ).map((it, i) => ({
                ...(it.umpire),
                color: COLORS[i % COLORS.length]
            })) ?? [],
        [fromYear, gender, level, relevantUMData, toYear]
    )

    const [selectedUM, setSelectedUM] = useState<Official | null>(null)


    const umpiresByName = useMemo(() => Object.fromEntries(relevantUMs.map(it => [it.name, it])), [relevantUMs])


    const gamesPerUmpire = relevantUMData?.map(it => ({
        name: it.umpire.name,
        value: it.managerStats.games,
        color: umpiresByName[it.umpire.name]?.color ?? 'pink'
    })).sort((a, b) => a.value - b.value)


    const gamesPerUmpirePerYear = relevantUMData?.map(it => ({
        name: it.umpire.name,
        value: Math.round(100 * it.managerStats.games / it.managerStats.years.length) / 100,
        color: umpiresByName[it.umpire.name]?.color ?? 'pink'
    })).sort((a, b) => a.value - b.value)

    const avgGamesPerWeek = relevantUMData?.map(it => ({
        name: it.umpire.name,
        value: it.managerStats.averageGamesPerWeek,
        color: umpiresByName[it.umpire.name]?.color ?? 'pink'
    })).sort((a, b) => a.value - b.value)


    const gamesPerWeek = useMemo(() =>
        Object.values(relevantUMData.reduce(
            (acc, it) => {
                Object.entries(it.managerStats.gamesEveryWeek).forEach(([epoch, value]) => {
                        const key = new Date(+epoch).toLocaleDateString();
                        if (!(key in acc)) {
                            acc[key] = {week: key}
                        }
                        acc[key] =
                            Object.assign({}, acc[key] ?? {}, {[it.umpire.name]: value})
                    }
                )
                return acc
            }, {} as {
                [key: string]: { week: string, [key: string]: number | string }
            })), [fromYear, relevantUMData, toYear]);

    const filteredGamesPerWeek = useMemo(() => (level === 'All' || (gender === '-' && level === 'Premier')) ?
            gamesPerWeek.map(it => Object.assign({week: it.week}, addOtherFieldToGraph(Object.fromEntries(Object.entries(it).filter(([k]) => k !== 'week')) as {
                [key: string]: number
            }, 0, false, 2)))
            : gamesPerWeek
        // we don't want this to recalculate twice for performance reasons.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        , [gamesPerWeek])

    

    return <>
        <Select w={200}
                data={[...relevantUMs.map(it => it.name), '-']}
                label="Umpire Manager"
                value={selectedUM?.name ?? '-'}
                onChange={it => setSelectedUM(relevantUMs.find(um => um.name === it) ?? null)}/>
        <Grid w="100%" gap={3} p={20}>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games Umpired</Title>
                <Text onClick={() => setViewAsPieChart(!viewAsPieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {viewAsPieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {viewAsPieChart ?
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
                              ]}></BarChart>
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
                          }, ...relevantUMs.map(it => ({color: it.color, name: it.name}))]}
                >{defs}</BarChart>
            </Grid.Col> : <>
                <Grid.Col span={{base: 12, md: 3}} p={10}>
                    <Title order={3} ta="center">Average Games Umpired per Week</Title>
                    <Text onClick={() => setViewAsPieChart(!viewAsPieChart)} my={5} ta="center" c="dimmed" fs="italic"
                          style={{textDecoration: 'underline'}}>
                        View as {viewAsPieChart ? 'Bar' : 'Pie'} Chart
                    </Text>

                    {viewAsPieChart ?
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
        </Grid></>
}