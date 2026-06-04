'use client'

import {BarChart, PieChart} from "@mantine/charts";
import {Grid, Group, Select, Table, Text, Title} from "@mantine/core";
import {Dispatch, SetStateAction, useCallback, useMemo} from "react";
import {UmpireStatsResponse} from "@/serverTypes";
import {COLORS, defs} from "@/graphUtils";
import {levelComparer} from "@/components/AllUmpiresGraphs";
import {urlFix} from "@/components/UmpireManagerGraph";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {AllGrades} from "@/components/pages/StatisticsPage";


interface UmpireGraphsParams {
    fromYear: number;
    toYear: number;
    level: AllGrades;
    gender: 'M' | 'F' | '-';
    umpireData: UmpireStatsResponse[];
    pieChart: boolean;
    setPieChart: Dispatch<SetStateAction<boolean>>;
}


export function UmpireGraphs({
                                 fromYear,
                                 toYear,
                                 level,
                                 gender,
                                 umpireData,
                                 pieChart,
                                 setPieChart
                             }: UmpireGraphsParams) {

    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const relevantUmpires = useMemo(() =>
            umpireData.filter(it => it.umpireStats).filter(it =>
                it.umpireStats.competitions.filter(c =>
                    fromYear <= c.year && c.year <= toYear && levelComparer(level, c) && (gender === '-' || c.gender === gender)
                ).length
            ) ?? [],
        [fromYear, gender, level, umpireData, toYear]
    )


    const setSelectedUmpire = useCallback((umpire: string | null) => {
        if (umpire) {
            router.push(pathname + `?tab=umpire&name=${urlFix(umpire)}`)
        } else {
            router.push(pathname + `?tab=umpire`)
        }
    }, [pathname, router])

    const selectedUmpire = useMemo(() => relevantUmpires.find(it => urlFix(it.umpire.name) === searchParams.get('name')) ?? relevantUmpires[0] ?? null, [relevantUmpires, searchParams]);


    const gamesPerVenue = Object.entries(selectedUmpire?.umpireStats.gamesPerVenue ?? {}).map(([k, v], i) =>
        ({name: k, value: v, color: COLORS[i % COLORS.length]})
    ).toSorted((a, b) => a.value - b.value)

    const gamesPerTeam = Object.entries(selectedUmpire?.umpireStats.gamesPerTeam ?? {}).map(([k, v], i) =>
        ({name: k, value: v, color: COLORS[i % COLORS.length]})
    ).toSorted((a, b) => a.value - b.value)

    const gamesPerUmpire = Object.entries(selectedUmpire?.umpireStats.gamesWithUmpires ?? {}).map(([k, v], i) =>
        ({name: k, value: v, color: COLORS[i % COLORS.length]})
    ).toSorted((a, b) => a.value - b.value)

    const gamesPerWeek = Object.entries(selectedUmpire?.umpireStats.compsEveryWeek ?? {}).map(([k, v]) =>
        Object.assign({week: new Date(+k).toLocaleDateString()}, ...Object.entries(v).map(([k, v]) => ({[k]: v})))
    )

    console.log(gamesPerWeek)

    return <>
        <Group ta="center" w="100%" align="center" justify="center" pt={15}>
            <Title order={3} ta="center">Umpire: </Title>
            <Select w={200}
                    searchable
                    data={relevantUmpires.map(it => it.umpire.name)}
                    value={selectedUmpire?.umpire.name ?? '-'}
                    onChange={it => setSelectedUmpire(it)}/>
        </Group>

        <Grid w="100%" gap={3} p={20}>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Stats</Title>
                <Table>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>
                                Statistic
                            </Table.Th>
                            <Table.Th>
                                Value
                            </Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        <Table.Tr>
                            <Table.Th>
                                Games Umpired
                            </Table.Th>
                            <Table.Td>
                                {selectedUmpire?.umpireStats?.games}
                            </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                            <Table.Th>
                                Average Games Umpired per Week
                            </Table.Th>
                            <Table.Td>
                                {selectedUmpire?.umpireStats?.averageGamesPerWeek}
                            </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                            <Table.Th>
                                Average Games Umpired per Year
                            </Table.Th>
                            <Table.Td>
                                {Math.round(100 * (selectedUmpire?.umpireStats?.games ?? 0) / (selectedUmpire?.umpireStats?.years?.length ?? 1)) / 100}
                            </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                            <Table.Th>
                                First year Umpiring
                            </Table.Th>
                            <Table.Td>
                                {Math.min(...(selectedUmpire?.umpireStats?.years ?? [0]))}
                            </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                            <Table.Th>
                                Years Umpired
                            </Table.Th>
                            <Table.Td>
                                {Math.max(...(selectedUmpire?.umpireStats?.years ?? [0])) - Math.min(...(selectedUmpire?.umpireStats?.years ?? [0])) + 1}
                            </Table.Td>
                        </Table.Tr>
                    </Table.Tbody>
                </Table>
            </Grid.Col>
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
                                  {label: 'Games Umpired', name: 'value'}
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
                                  {label: 'Games Umpired', name: 'value'}
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
                <Title order={3} ta="center">Games With Co-Umpires</Title>
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
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games Per Week</Title>


                <BarChart data={gamesPerWeek}
                          withTooltip
                          mx="auto"
                          type="stacked"
                          series={(selectedUmpire?.umpireStats?.competitions ?? []).map((it, i) => ({
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