import {Clipper} from "@/components/Clipper";


export default async function Home({params}: {
    params: Promise<{ id: string }>
}) {
    const {id} = await params;
    return <Clipper id={id}></Clipper>
}
