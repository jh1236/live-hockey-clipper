import {ViewClips} from "@/components/ViewClips";


export default async function Home({
                                       params,
                                   }: {
    params: Promise<{ blob: string }>
}) {
    const {blob} = await params;
    return <ViewClips blob={blob}></ViewClips>
}
