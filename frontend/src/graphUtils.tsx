import {Fragment} from "react";

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
            <pattern id={`checkers${i}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"
                     patternTransform="rotate(45)scale(0.5)">
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


const OTHER_THRESHOLD = 0.2



type ColorblindPieChartData = (Omit<PieChartData[number], 'color'> & {
    color?: string
})[]
type PieChartData = {
    name: string,
    value: number,
    color: string
}[];

type LineChartData = {
    [key: string]: number
};

type GraphData = ColorblindPieChartData | LineChartData;

export const OTHER_COLOR = '#888888';

function addOtherFieldToPieGraph(data: ColorblindPieChartData, targetValue: number, otherIndex = -1, average = false) {
    let value = 0
    let count = 0
    const out: ColorblindPieChartData = []
    for (const datum of data) {
        if (datum.value >= targetValue) {
            out.push(datum)
        } else {
            count++;
            value += datum.value

        }
    }
    if (count === 0) {
        return data
    }
    if (average) {
        value /= count
    }
    if (otherIndex >= 0) {
        out.splice(otherIndex, 0, {value: Math.round(value * 100) / 100, name: 'Other', color: OTHER_COLOR})
    } else {
        out.push({value: Math.round(value * 100) / 100, name: 'Other', color: OTHER_COLOR})
    }
    return out
}


export function addOtherFieldToGraph(data: PieChartData, otherIndex: number, average?: boolean, absoluteValue?: number | null): PieChartData
export function addOtherFieldToGraph(data: LineChartData, otherIndex: number, average?: boolean, absoluteValue?: number | null): LineChartData
export function addOtherFieldToGraph(data: GraphData, otherIndex: number = -1, average: boolean = false, absoluteValue: number | null = null): GraphData {
    let fixedData;
    if (Array.isArray(data)) {
        fixedData = data;
    } else {
        fixedData = Object.entries(data).map(([k, v]) => ({name: k, value: v}))
    }
    const targetValue = absoluteValue !== null ? absoluteValue : Math.min(
        OTHER_THRESHOLD * fixedData.reduce((a, b) => Math.max(a, b.value), 0),
        fixedData.toSorted((a, b) => b.value - a.value)?.[29]?.value ?? 0
    )
    const otherised = addOtherFieldToPieGraph(fixedData, targetValue, otherIndex, average)
    if (Array.isArray(data)) {
        return otherised
    } else {
        return Object.fromEntries(otherised.map(it => [it.name, it.value]))
    }
}