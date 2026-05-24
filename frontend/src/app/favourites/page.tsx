'use client';

import {useEffect, useState} from "react";
import {Clip, SERVER_ADDRESS} from "@/serverTypes";
import {ClipsDisplay} from "@/components/ClipsDisplay";
import {ActionIcon, Box, Flex, Title} from "@mantine/core";
import Link from "next/link";
import {FaArrowLeft} from "react-icons/fa6";

export default function Page() {
    const [clips, setClips] = useState<(Clip | undefined)[] | null>([]);

    useEffect(() => {
        fetch(SERVER_ADDRESS + '/api/clips/favourite/get').then(it => it.json()).then(({clips}) => setClips(clips))
    }, []);


    return <Flex direction="column" align="center" h="100%" w="100%" ta="center" style={{overflowX: 'hidden'}}>
        <Box h={0} w="100%" pos="relative">
            <Box left={0} pos="absolute">
                <Link href='/'>
                    <ActionIcon
                        m={20}
                        variant="subtle">
                        <FaArrowLeft/>
                    </ActionIcon>
                </Link>
            </Box>
        </Box>
        <Title order={2} p={20}>Saved Clips</Title>
        <ClipsDisplay clips={clips} setClips={setClips} linkToGame noClipMessage={
            <>There are no clips saved. <br/> Save a clip by
                pressing the star button in the top right!</>
        }/>
    </Flex>
}