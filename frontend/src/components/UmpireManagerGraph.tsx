'use client'

import {BarChart, PieChart} from "@mantine/charts";
import {Grid, Group, Select, Text, Title} from "@mantine/core";
import {Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState} from "react";
import {UmpireStatsResponse} from "@/serverTypes";
import {COLORS, defs} from "@/graphUtils";
import {levelComparer} from "@/components/AllUmpiresGraphs";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {AllGrades} from "@/components/pages/StatisticsPage";


interface UmpireMangerGraphsParams {
    fromYear: number;
    toYear: number;
    level: AllGrades;
    gender: 'M' | 'F' | '-';
    umpireData: UmpireStatsResponse[];
    pieChart: boolean;
    setPieChart: Dispatch<SetStateAction<boolean>>;
}

export const urlFix = (toFix: string) => toFix.replace(' ', '_').toLowerCase()

export function UmpireManagerGraphs({
                                        fromYear,
                                        toYear,
                                        level,
                                        gender,
                                        umpireData,
                                        pieChart,
                                        setPieChart
                                    }: UmpireMangerGraphsParams) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const relevantUMs = useMemo(() =>
            umpireData.filter(it => it.managerStats).filter(it =>
                it.managerStats.competitions.filter(c =>
                    fromYear <= c.year && c.year <= toYear && levelComparer(level, c) && (gender === '-' || c.gender === gender)
                ).length
            ) ?? [],
        [fromYear, gender, level, umpireData, toYear]
    )

    const setSelectedUM = useCallback((umpire: string | null) => {
        if (umpire) {
            router.push(pathname + `?tab=umpireManager&name=${urlFix(umpire)}`)
        } else {
            router.push(pathname + `?tab=umpireManager`)
        }
    }, [pathname, router])

    const selectedUM = useMemo(() => relevantUMs.find(it => urlFix(it.umpire.name) === searchParams.get('name')) ?? relevantUMs[0] ?? null, [relevantUMs, searchParams]);


    const gamesPerVenue = Object.entries(selectedUM?.managerStats.gamesPerVenue ?? {}).map(([k, v], i) =>
        ({name: k, value: v, color: COLORS[i % COLORS.length]})
    ).toSorted((a, b) => a.value - b.value)

    const gamesPerTeam = Object.entries(selectedUM?.managerStats.gamesPerTeam ?? {}).map(([k, v], i) =>
        ({name: k, value: v, color: COLORS[i % COLORS.length]})
    ).toSorted((a, b) => a.value - b.value)

    const gamesPerUmpire = Object.entries(selectedUM?.managerStats.gamesWithUmpires ?? {}).map(([k, v], i) =>
        ({name: k, value: v, color: COLORS[i % COLORS.length]})
    ).toSorted((a, b) => a.value - b.value)

    const gamesPerWeek = Object.entries(selectedUM?.managerStats.compsEveryWeek ?? {}).map(([k, v]) =>
        Object.assign({week: new Date(+k).toLocaleDateString()}, ...Object.entries(v).map(([k, v]) => ({[k]: v})))
    )


    return <>
        <Group ta="center" w="100%" align="center" justify="center" pt={15}>
            <Title order={3} ta="center">Umpire Manager: </Title>
            <Select w={200}
                    data={relevantUMs.map(it => it.umpire.name)}
                    value={selectedUM?.umpire.name ?? '-'}
                    onChange={it => setSelectedUM(it)}/>
        </Group>

        <Grid w="100%" gap={3} p={20}>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games Per Venue</Title>
                <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {pieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {pieChart ?
                    <PieChart data={gamesPerVenue} withTooltip tooltipDataSource="segment"
                              mx="auto"
                              size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={gamesPerVenue}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Games Umpire Managed', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: gamesPerVenue.map(it => it.value).reduce((a, b) => a + b, 0) / gamesPerVenue.length,
                                      color: 'dimmed',
                                      label: 'Average',
                                      labelPosition: 'insideTopLeft',
                                  },
                              ]}>{defs}
                    </BarChart>
                }
            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games Per Team</Title>
                <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {pieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {pieChart ?
                    <PieChart data={gamesPerTeam} withTooltip tooltipDataSource="segment"
                              mx="auto"
                              size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={gamesPerTeam}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Games Umpire Managed', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: gamesPerTeam.map(it => it.value).reduce((a, b) => a + b, 0) / gamesPerTeam.length,
                                      color: 'dimmed',
                                      label: 'Average',
                                      labelPosition: 'insideTopLeft',
                                  },
                              ]}>{defs}</BarChart>
                }
            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games With Umpires</Title>
                <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {pieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {pieChart ?
                    <PieChart data={gamesPerUmpire} withTooltip tooltipDataSource="segment"
                              mx="auto"
                              size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={gamesPerUmpire}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Games Umpire Managed', name: 'value'}
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
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games Per Week</Title>


                <BarChart data={gamesPerWeek}
                          withTooltip
                          mx="auto"
                          type="stacked"
                          series={(selectedUM?.managerStats?.competitions ?? []).map((it, i) => ({
                              name: it.name,
                              color: COLORS[i % COLORS.length]
                          }))}
                          dataKey="week"
                          h={300}
                          referenceLines={[
                              {
                                  y: gamesPerWeek.map(it => it.value).reduce((a, b) => a + b, 0) / gamesPerWeek.length,
                                  color: 'dimmed',
                                  label: 'Average',
                                  labelPosition: 'insideTopLeft',
                              },
                          ]}>{defs}</BarChart>

            </Grid.Col>

        </Grid></>
}