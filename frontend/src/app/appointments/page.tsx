'use client'

import {AreaChart, BarChart, PieChart} from "@mantine/charts";
import {Grid, Group, Select, Text, Title} from "@mantine/core";
import {useEffect, useMemo, useState} from "react";
import {Competition, Official, SERVER_ADDRESS} from "@/serverTypes";
import {COLORS, defs} from "@/components/IndividualGraph";
import {AllUmpiresGraphs} from "@/components/AllUmpiresGraphs";


const ORDER_GRADES = ['Prem One Men', 'Prem One Women', 'Prem Two Men', 'Prem Two Women', '11/12 Div One Boys', '11/12 Div One Girls', '9/10 Div One Boys', '9/10 Div One Girls']


export default function Page() {
    const [fromYear, setFromYear] = useState<number>(new Date().getFullYear());
    const [toYear, setToYear] = useState<number>(new Date().getFullYear());
    const [grade, setGrade] = useState<string>('All')
    const [allUmpires, setAllUmpires] = useState<Official[]>([])
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
                setAllUmpires(it.umpires.map((it: any, i: number) => ({...it, color: COLORS[i % COLORS.length]})))
            })
    }, []);

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
        <AllUmpiresGraphs fromYear={fromYear} toYear={toYear} grade={grade} allUmpires={allUmpires}></AllUmpiresGraphs>
    </>
}