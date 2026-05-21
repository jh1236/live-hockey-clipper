export const SERVER_ADDRESS = process.env.NEXT_PUBLIC_BACKEND_ADDRESS

export type Clip = {
    timecode: string,
    length: string,
    name: string,
    link?: string,
    categories?: string[],
};

export interface AppointmentGame {
    altiusId: string,
    startTime: number,
    umpires: string[],
    teams: string[],
    grade: string,
    tournamentId: number
}

export interface ClipGame {
    blob: string
    teamOne: string
    teamTwo: string
    teamOneLongName: string
    teamTwoLongName: string
    teamOneImage: string
    teamTwoImage: string
    competitionName: string
    startTime: number
    lastServerPing: number
    isLive: boolean
    altiusLink?: string
    teamstarLink?: string
    officials: [] | [string, string]
}
