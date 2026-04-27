import {PlayerLevel} from "@/app/api/game/types";

export interface StructureResponse {
    id: string
    name: string
    siteId: string
    slug: string
    featuredLayout: string
    hideChildrenOfTypes: string[]
    parentId: string
    hideHeader: boolean
    inheritCampaigns: boolean
    competitions: {
        id: string
        name: string
        image?: {
            id: string
            blobId: string
            mimeType: string
        }
    }[]
    playerLevels: PlayerLevel[]
    type: string
}
