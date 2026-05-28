export const SERVER_ADDRESS = process.env.NEXT_PUBLIC_BACKEND_ADDRESS

export type Clip = {
    startTime: string,
    duration: string,
    name: string,
    id?: number,
    link: string,
    categories?: string[],
    favourite?: boolean,
    gameId: string
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
    umpires: Official[]
    reserve_umpire: Official | null
    tech_official: Official | null
    umpire_manager: Official | null
    startTime: number
    streamStartTime: number
    teamstarId: string
    completed: boolean
    venue: Venue
}

export interface Team {
    code: string
    id: number
    imageLink: string
    longName: string
    timeCreated: number
}

export interface Official {
    name: string
    gender: string
    panel: string | null
    role: string
    timeCreated: number
}

export interface Competition {
    ageLevel: string
    altiusId: number
    whistleIqId: number
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
