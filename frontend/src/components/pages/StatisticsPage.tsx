'use client'

import {Group, Select, Tabs, Title} from "@mantine/core";
import {Suspense, useCallback, useEffect, useMemo, useState} from "react";
import {Competition, SERVER_ADDRESS, UmpireStatsResponse} from "@/serverTypes";
import {AllUmpiresGraphs} from "@/components/AllUmpiresGraphs";
import {FaUser, FaUserGraduate, FaUserGroup} from "react-icons/fa6";
import {UmpireManagerGraphs} from "@/components/UmpireManagerGraph";
import {UmpireGraphs} from "@/components/UmpireGraph";
import {usePathname, useRouter, useSearchParams} from "next/navigation";


type RealGrades = 'Prem One' | 'Prem Two' | '11/12 Div One' | '9/10 Div One'
export type AllGrades = RealGrades | 'All' | 'Premier'

const ORDER_GRADES = ['Prem One', 'Prem Two', 'Prem Three', '11/12 Div One', '9/10 Div One'] as RealGrades[]

export function StatisticsPage() {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()

    const setTab = useCallback((tab: string) => {
        router.push(pathname + `?tab=${tab}`)
    }, [pathname, router])

    const tab = searchParams.get('tab') ?? 'allUmpires'

    const [fromYear, setFromYear] = useState<number>(new Date().getFullYear());
    const [toYear, setToYear] = useState<number>(new Date().getFullYear());
    const [umpireData, setUmpireData] = useState<UmpireStatsResponse[]>([])
    const [pieChart, setPieChart] = useState<boolean>(true);
    const [level, setLevel] = useState<AllGrades>('All')
    const [gender, setGender] = useState<'M' | 'F' | '-'>('-')
    const [levelsInYears, setLevelsInYears] = useState<{
        [year: string]: RealGrades[]
    }>({'-': ORDER_GRADES})
    const levelsInRange: AllGrades[] = useMemo(() => {
        let out: Set<RealGrades> = new Set();
        (levelsInYears['-']).forEach(it => {
            out.add(it)
        })
        for (const i in Array.from({length: toYear - fromYear})) {
            const year = +fromYear + (+i);
            const temp = new Set();
            (levelsInYears[year.toString()] ?? []).forEach(it => {
                console.log(it)
                temp.add(it)
            })
            out = out.intersection(temp)
        }
        const strings: RealGrades[] = Array.from(out).toSorted((a, b) => ORDER_GRADES.indexOf(a) - ORDER_GRADES.indexOf(b))
        return [...strings, 'All', 'Premier'] as AllGrades[]
    }, [fromYear, levelsInYears, toYear])

    useEffect(() => {
        fetch(`${SERVER_ADDRESS}/api/appointments/available`).then(res => res.json()).then((comps: Competition[]) => {
            const level: { [key: string]: string[] } = {}
            for (const comp of comps) {
                const key = comp.year.toString();
                if (!(key in level)) {
                    level[key] = []
                }
                level[key].push(comp.level)
            }
            setLevelsInYears(prev => Object.assign({}, prev, level))
        });
    }, []);

    useEffect(() => {
        if (!toYear || !fromYear) return
        setUmpireData([])
        // setPerEmailProviderStats([])
        // setPerWeekStats({})
        const per_ump_url = new URL(`${SERVER_ADDRESS}/api/appointments/per_umpire_stats`)
        const per_week_url = new URL(`${SERVER_ADDRESS}/api/appointments/per_week_stats`)
        const per_email_url = new URL(`${SERVER_ADDRESS}/api/appointments/per_email_provider_stats`)

        per_ump_url.searchParams.set('to_year', toYear.toString())
        per_week_url.searchParams.set('to_year', toYear.toString())
        per_email_url.searchParams.set('to_year', toYear.toString())

        per_ump_url.searchParams.set('from_year', fromYear.toString())
        per_week_url.searchParams.set('from_year', fromYear.toString())
        per_email_url.searchParams.set('from_year', fromYear.toString())

        if (level !== 'All') {
            per_ump_url.searchParams.set('level', level)
            per_week_url.searchParams.set('level', level)
            per_email_url.searchParams.set('level', level)
        }
        if (gender !== '-') {
            per_ump_url.searchParams.set('gender', gender)
            per_week_url.searchParams.set('gender', gender)
            per_email_url.searchParams.set('gender', gender)
        }

        let cancelled = false;
        fetch(per_ump_url)
            .then(it => it.json())
            .then(it => {
                if (!cancelled) {
                    setUmpireData(it.statistic)
                }
            })
        
        return () => {
            cancelled = true
        }
    }, [fromYear, gender, level, toYear]);

    return <Suspense>
        <Group w="100%" justify="center">
            <Title ta="center" m={20}>Graphs For</Title>
            <Select w={200} defaultValue="All"
                    data={levelsInRange}
                    value={level}
                    onChange={it => setLevel(it ?? 'All')}/>
            <Select w={100} defaultValue={'-'}
                    data={[
                        {value: 'M', label: level?.match(/^\d/) ? 'Boys' : 'Men'},
                        {value: 'F', label: level?.match(/^\d/) ? 'Girls' : 'Women'},
                        {value: '-', label: '-'}
                    ]}
                    value={gender}
                    onChange={it => setGender(it ?? '-')}/>
            <Title ta="center" m={20}> From </Title>
            <Select w={100}
                    data={[...Object.keys(levelsInYears).filter(it => +it <= toYear), '-']}
                    value={fromYear.toString()}
                    onChange={e => {
                        if (e === null) return
                        if (e === '-') {
                            setFromYear(Object.keys(levelsInYears).reduce((a, b) => Math.min(a, +b), Number.MAX_VALUE))
                        }
                        setFromYear(+e)
                    }}/>
            <Title ta="center" m={20}> To </Title>
            <Select w={100}
                    data={[...Object.keys(levelsInYears).filter(it => +it >= fromYear), '-']}
                    value={toYear.toString()}
                    onChange={e => {
                        if (e === null) return
                        if (e === '-') {
                            setToYear(Object.keys(levelsInYears).reduce((a, b) => Math.max(a, +b), 0))
                        }
                        setToYear(+e)
                    }}/>
        </Group>
        <Tabs keepMounted={false} value={tab} onChange={it => setTab(it ?? 'allUmpires')}>
            <Tabs.List grow>
                <Tabs.Tab value="allUmpires" leftSection={<FaUserGroup size={12}/>}>
                    All Umpires
                </Tabs.Tab>
                <Tabs.Tab value="umpire" leftSection={<FaUser size={12}/>}>
                    Umpire
                </Tabs.Tab>
                <Tabs.Tab value="umpireManager" leftSection={<FaUserGraduate size={12}/>}>
                    Umpire Managers
                </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="allUmpires">
                <AllUmpiresGraphs pieChart={pieChart} setPieChart={setPieChart} fromYear={fromYear} toYear={toYear} level={level} gender={gender}
                                  umpireData={umpireData}></AllUmpiresGraphs>
            </Tabs.Panel>
            <Tabs.Panel value="umpire">
                <UmpireGraphs pieChart={pieChart} setPieChart={setPieChart} fromYear={fromYear} toYear={toYear} level={level} gender={gender}
                              umpireData={umpireData}></UmpireGraphs>
            </Tabs.Panel>
            <Tabs.Panel value="umpireManager">
                <UmpireManagerGraphs pieChart={pieChart} setPieChart={setPieChart} fromYear={fromYear} toYear={toYear} level={level} gender={gender}
                                     umpireData={umpireData}></UmpireManagerGraphs>
            </Tabs.Panel>
        </Tabs>
    </Suspense>
}