'use client';

import {useEffect, useMemo, useState} from "react";
import {Clip, SERVER_ADDRESS} from "@/serverTypes";
import {ClipsDisplay} from "@/components/ClipsDisplay";
import {ActionIcon, Box, Button, Checkbox, Flex, Group, Popover, Text, Title} from "@mantine/core";
import Link from "next/link";
import {FaArrowLeft} from "react-icons/fa6";
import {FaSlidersH} from "react-icons/fa";

interface TagSelectorProps {
    selectedTags: string[];
    setSelectedTags: (value: (((prevState: string[]) => string[]) | string[])) => void;
    tags: [string, number][];
}

function TagSelector({selectedTags, setSelectedTags, tags}: TagSelectorProps) {
    return <>
        <Title order={3}>Tags</Title>
        <Checkbox.Group value={selectedTags} onChange={setSelectedTags}>
            {tags.map(([tag, count], i) => <Checkbox key={i} my={5} value={tag} label={<Group justify="left">
                <Text inline>{tag}</Text><Text inline c="dimmed">({count})</Text>
            </Group>}></Checkbox>)}
        </Checkbox.Group>
    </>;
}

export default function Page() {
    const [clips, setClips] = useState<(Clip | undefined)[] | null>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([])

    const tags = useMemo(() => {
        const out: { [tag: string]: number } = {}
        for (const i of clips ?? []) {
            if (!i || !i.categories) continue;
            for (const t of i.categories) {
                if (!(t in out)) {
                    out[t] = 1
                } else {
                    out[t]++;
                }
            }
        }
        return Object.entries(out).sort()
    }, [clips])

    const activeClips = useMemo(() => selectedTags.length ?
            clips?.filter(it => it && selectedTags.reduce((a, b) => a && it.categories!.includes(b), true)) ?? null :
            clips,
        [clips, selectedTags]
    )

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
        <Group justify="space-around">
            <Title order={2} p={20}>Saved Clips</Title>
            <Popover>
                <Popover.Target>
                    <ActionIcon hiddenFrom="md">
                        <FaSlidersH/>
                    </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown>
                    <TagSelector selectedTags={selectedTags} setSelectedTags={setSelectedTags} tags={tags}/>
                </Popover.Dropdown>
            </Popover>
        </Group>
        <Group align="flex-start">
            <Box w={{base: '100%', md: '80%'}}>
                <ClipsDisplay clips={activeClips} setClips={setClips} linkToGame noClipMessage={
                    <>There are no clips saved. <br/> Save a clip by
                        pressing the star button in the top right!</>
                }/>
            </Box>
            <Box visibleFrom='md'>
                <TagSelector selectedTags={selectedTags} setSelectedTags={setSelectedTags} tags={tags}/>
            </Box>
        </Group>
    </Flex>
}