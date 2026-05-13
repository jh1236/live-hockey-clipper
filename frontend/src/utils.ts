export function hmsToSecondsOnly(str: string) {
    const p = str.split(':');
    let s = 0, m = 1;

    while (p.length > 0) {
        s += m * parseInt(p.pop()!, 10);
        m *= 60;
    }

    return s;
}

export function secondsToHMS(secs: number, includeHours: boolean = true) {
    const hours = Math.floor(secs / (60 * 60)).toString().padStart(2, '0')
    const minutes = (Math.floor(secs / 60) % 60).toString().padStart(2, '0')
    const seconds = (secs % 60).toString().padStart(2, '0')
    if (!includeHours) {
        return `${minutes}:${seconds}`;
    }
    return `${hours}:${minutes}:${seconds}`;
}

export function daysIntoYear(date: Date) {
    return (
        Date.UTC(date.getFullYear(),
            date.getMonth(),
            date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)
    ) / 24 / 60 / 60 / 1000;
}

export function getMonday(d: Date) {
    const day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
}
