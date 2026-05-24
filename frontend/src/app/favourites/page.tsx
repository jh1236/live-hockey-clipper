'use client';

import {useEffect, useState} from "react";
import {Clip, SERVER_ADDRESS} from "@/serverTypes";
import {ClipsDisplay} from "@/components/ClipsDisplay";
import {Flex, Title} from "@mantine/core";

export default function Page() {
    const [clips, setClips] = useState<(Clip | undefined)[] | null>([]);

    useEffect(() => {
        fetch(SERVER_ADDRESS + '/api/clips/favourite/get').then(it => it.json()).then(({clips}) => setClips(clips))
    }, []);


    return <Flex direction="column" align="center" h="100%" w="100%" ta="center" style={{overflowX: 'hidden'}}>
        <Title order={2} p={20}>Saved Clips</Title>
        <ClipsDisplay clips={clips} setClips={setClips} noClipMessage={
            <>There are no clips saved. <br/> Save a clip by
                pressing the star button in the top right!</>
        }/>
    </Flex>
}