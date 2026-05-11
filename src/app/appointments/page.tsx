'use client'

import {PieChart} from "@mantine/charts";
import {useEffect, useMemo, useState} from "react";

type Game = {
    altius_id: string,
    start_time: number,
    umpires: string[],
    game_name: string,
    grade: string,
}

const COLORS = [
    '#e6194b',
    '#3cb44b',
    '#ffe119',
    '#4363d8',
    '#f58231',
    '#911eb4',
    '#46f0f0',
    '#f032e6',
    '#bcf60c',
    '#fabebe',
    '#008080',
    '#e6beff',
    '#9a6324',
    '#fffac8',
    '#800000',
    '#aaffc3',
    '#808000',
    '#ffd8b1',
    '#000075',
    '#808080',
]

export default function Page() {
    const [data, setData] = useState<Game[]>([]);
    useEffect(() => {
        fetch('http://localhost:5000').then(res => res.json()).then(res => setData(res));
    }, []);
    const chartData = useMemo(() => {
        const outMap = new Map<string, number>();
        for (const game of data) {
            for (const umpire of game.umpires) {
                outMap.set(umpire, (outMap.get(umpire) ?? 0) + 1)
            }
        }
        return [...outMap.entries().map(([name, value], i) => ({name, value, color: COLORS[i % 20]}))];
    }, [data])

    return <>
        <PieChart data={chartData} withTooltip tooltipDataSource="segment" mx="auto"/>
    </>
}