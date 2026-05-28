import {IndividualGraph} from "@/components/IndividualGraph";

export default async function Page({params}: {
    params: Promise<{ name: string }>
}) {
    const {name} = await params

    return <IndividualGraph name={name}/>
}