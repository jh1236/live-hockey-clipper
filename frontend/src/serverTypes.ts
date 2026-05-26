export const SERVER_ADDRESS = process.env.NEXT_PUBLIC_BACKEND_ADDRESS

export type Clip = {
    startTime: string,
    duration: string,
    name: string,
    id?: number,
    link: string,
    categories?: string[],
    favourite?: boolean,
    gameBlob: string
};

export interface Game {
    altiusId: string
    awayTeam: Team
    awayTeamScore: number | null
    competition: Competition
    homeTeam: Team
    homeTeamScore: number | null
    id: number
    liveHockeyId: string
    officials: string[]
    startTime: number
    streamStartTime: number
    teamstarId: string
    venue: Venue
}

export interface Team {
    code: string
    id: number
    imageLink: string
    longName: string
    timeCreated: number
}

export interface Competition {
    ageLevel: string
    altiusId: number
    gender: string
    id: number
    isPremier: boolean
    level: string
    liveHockeyId: string
    timeCreated: number
    year: number
}


export interface Venue {
    code: string
    id: number
    longName: string
    timeCreated: number
    turfNumber: number
}
