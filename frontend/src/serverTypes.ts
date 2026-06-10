export const SERVER_ADDRESS = process.env.NEXT_PUBLIC_BACKEND_ADDRESS ?? 'http://localhost:5003'

export type Clip = {
    game: Game;
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
    identifier: string
    liveHockeyId: string
    umpires: Official[]
    reserve_umpire: Official | null
    tech_official: Official | null
    umpire_manager: Official | null
    startTime: number
    streamStartTime: number
    teamstarId: string
    complete: boolean
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
    identifier: string
    isPremier: boolean
    level: string
    liveHockeyId: string
    timeCreated: number
    year: number
    name: string
}


export interface Venue {
    hasVideo: boolean;
    id: number
    code: string
    shortName: string;
    longName: string
    timeCreated: number
    turfNumber: number
}

export interface UmpireStatsResponse {
    umpire: Official,
    umpireStats: UmpireStats,
    managerStats: Omit<UmpireStats, 'gamesWithUmpireManagers'>
}

interface UmpireStats {
    averageGamesPerWeek: number
    averageLadderDifference: number
    averageLadderPosition: number
    averageScoreDifference: number
    gamesPerTeam: { [team: string]: number }
    cardsPerTeam: { [team: string]: { [color: string]: number } }
    cardsEveryWeek: { [epoch: string]: { [color: string]: number } }
    cardsPerGameEveryWeek: { [epoch: string]: { [color: string]: number } }
    cards: { [color: string]: number }
    games: number
    gamesEveryWeek: { [epoch: string]: number }
    compsEveryWeek: { [epoch: string]: { [comp: string]: number } }
    gamesPerVenue: { [venue: string]: number }
    gamesWithUmpireManagers: { [umpireManager: string]: number }
    gamesWithUmpires: { [umpire: string]: number }
    years: number[]
    competitions: Competition[]
}