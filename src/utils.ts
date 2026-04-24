export function hmsToSecondsOnly(str: string) {
    const p = str.split(':');
    let s = 0, m = 1;

    while (p.length > 0) {
        s += m * parseInt(p.pop()!, 10);
        m *= 60;
    }

    return s;
}

export function secondsToHMS(secs: number, includeHours:boolean = true) {
    const hours = Math.floor(secs / (60 * 60)).toString().padStart(2, '0')
    const minutes = (Math.floor(secs / 60) % 60).toString().padStart(2, '0')
    const seconds = (secs % 60).toString().padStart(2, '0')
    if (!includeHours) {
        return `${minutes}:${seconds}`;
    }
    return `${hours}:${minutes}:${seconds}`;
}
