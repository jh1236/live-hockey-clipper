import {Clipper} from "@/components/Clipper";


export default async function Home({
                                       params,
                                   }: {
    params: Promise<{ blob: string }>
}) {
    const {blob} = await params;
    return <Clipper blob={blob}></Clipper>
}
