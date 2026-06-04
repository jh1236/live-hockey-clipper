import {Suspense} from "react";
import {StatisticsPage} from "@/components/pages/StatisticsPage";

export default function Page() {
    return <Suspense>
        <StatisticsPage></StatisticsPage>
    </Suspense>
}