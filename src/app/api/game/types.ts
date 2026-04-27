export type LiveHockeyGame = {
    id: string
    extId: string
    siteId: string
    start: string
    startBroadcast: string
    viewerStartTime: string
    streamStart: string
    end: string
    streamEnd: string
    venueId: string
    venueExtIds: {
        id: string
        origin: string
    }[]
    homeTeam: {
        id: string
        name: string
        parentId: string
        level1: string
        extIds: {
            id: string
            origin: string
        }[]
        homeHex: string
        awayHex: string
        siteId: string
        type: string
        slug: string
        shortName: string
        longName: string
        logo: {
            id: string
            blobId: string
            mimeType: string
        }
    }
    awayTeam: {
        id: string
        name: string
        parentId: string
        level1: string
        extIds: {
            id: string
            origin: string
        }[]
        homeHex: string
        awayHex: string
        siteId: string
        type: string
        slug: string
        shortName: string
        longName: string
        logo: {
            id: string
            blobId: string
            mimeType: string
        }
    }
    competition: {
        id: string
        name: string
        type: string
        start: string
        end: string
        siteId: string
        extIds: {
            id: string
            origin: string
        }[]
        playerLevel: PlayerLevel
        image: {
            id: string
            blobId: string
            mimeType: string
        }
    }
    uiConfigId: string
    filter: string[]
    live: boolean
    score: {
        home: number
        away: number
    }
    extSrc: string
}

export interface PlayerLevel {
    name: string
    extId: string
    hidden: boolean
    gender?: string
    category?: string
}
