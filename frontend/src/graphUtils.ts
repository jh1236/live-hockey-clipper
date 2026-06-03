const OTHER_THRESHOLD = 0.2

export function addOtherFieldToGraph(data: {
    name: string,
    value: number,
    color: string
}[], otherIndex = -1, average = false) {
    const targetValue = Math.min(
        OTHER_THRESHOLD * data.reduce((a, b) => Math.max(a, b.value), 0),
        data.toSorted((a, b) => b.value - a.value)?.[29]?.value ?? 0
    )
    let value = 0
    let count = 0
    const out: { name: string, value: number, color: string }[] = []
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
        out.splice(otherIndex, 0, {value: Math.round(value * 100) / 100, name: 'Other', color: '#888888'})
    } else {
        out.push({value: Math.round(value * 100) / 100, name: 'Other', color: '#888888'})
    }
    return out
}