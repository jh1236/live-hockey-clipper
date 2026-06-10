'use client';

import {Dispatch, SetStateAction, useEffect, useMemo, useState} from "react";
import {Clip, SERVER_ADDRESS} from "@/serverTypes";
import {ClipsDisplay} from "@/components/ClipsDisplay";
import {ActionIcon, Box, Button, Checkbox, Flex, Group, Popover, Text, Title} from "@mantine/core";
import Link from "next/link";
import {FaArrowLeft} from "react-icons/fa6";
import {FaSlidersH} from "react-icons/fa";

interface TagSelectorProps {
    selectedTags: string[];
    setSelectedTags: Dispatch<SetStateAction<string[]>>;
    selectedComps: string[];
    setSelectedComps: Dispatch<SetStateAction<string[]>>;
    selectedUmpires: string[];
    setSelectedUmpires: Dispatch<SetStateAction<string[]>>;
    clips: (Clip | undefined)[] | null;
    activeClips: (Clip | undefined)[] | null;
}

function TagSelector({
                         selectedTags,
                         setSelectedTags,
                         selectedComps,
                         setSelectedComps,
                         setSelectedUmpires,
                         selectedUmpires,
                         clips,
                         activeClips
                     }: TagSelectorProps) {
    const allTags = useMemo(() => {
        const out: string[] = []
        for (const i of clips ?? []) {
            if (!i || !i.categories) continue;
            for (const t of i.categories) {
                if (!out.includes(t)) {
                    out.push(t)
                }
            }
        }
        return out.sort()
    }, [clips])

    const tags = useMemo(() => {
        const out: { [tag: string]: number } = Object.fromEntries(allTags.map(it => [it, 0]))
        for (const i of activeClips ?? []) {
            if (!i || !i.categories) continue;
            for (const t of i.categories) {
                out[t]++;
            }
        }
        return Object.entries(out).sort()
    }, [activeClips, allTags])

    const allComps = useMemo(() => {
        const out: string[] = []
        for (const i of clips ?? []) {
            if (!i) continue;
            const key = i.game.competition.level;
            if (!out.includes(key)) {
                out.push(key)
            }
        }
        return out
    }, [clips])

    const comps = useMemo(() => {
        const out: { [tag: string]: number } = Object.fromEntries(allComps.map(it => [it, 0]))
        for (const i of activeClips ?? []) {
            if (!i) continue;
            const key = i.game.competition.level;
            out[key]++;
        }
        return Object.entries(out).sort()
    }, [activeClips, allComps])

    const allUmps = useMemo(() => {
        const out: string[] = []
        for (const i of clips ?? []) {
            if (!i) continue;
            for (const ump of i.game.umpires) {
                if (!out.includes(ump.name)) {
                    out.push(ump.name)
                }
            }
        }
        return out
    }, [clips])

    const umps = useMemo(() => {
        const out: { [tag: string]: number } = Object.fromEntries(allUmps.map(it => [it, 0]))
        for (const i of activeClips ?? []) {
            if (!i) continue;
            for (const ump of i.game.umpires) {
                if (!(ump.name in out)) {
                    out[ump.name] = 0
                }
                out[ump.name]++;
            }
        }
        return Object.entries(out).sort()
    }, [activeClips, allUmps])

    if (!clips) {
        return undefined;
    }

    return <>
        <Title order={3}>Filter</Title>
        <Checkbox.Group label="Umpires" value={selectedUmpires} onChange={setSelectedUmpires} mt={20}>
            {umps.map(([tag, count], i) => <Checkbox key={i} my={5} value={tag} label={<Group justify="left">
                <Text inline>{tag}</Text><Text inline c="dimmed">({count})</Text>
            </Group>}></Checkbox>)}
        </Checkbox.Group>
        <Checkbox.Group label="Grade" value={selectedComps} onChange={setSelectedComps} mt={20}>
            {comps.map(([tag, count], i) => <Checkbox key={i} my={5} value={tag} label={<Group justify="left">
                <Text inline>{tag}</Text><Text inline c="dimmed">({count})</Text>
            </Group>}></Checkbox>)}
        </Checkbox.Group>
        <Checkbox.Group label="Tags" value={selectedTags} onChange={setSelectedTags} mt={20}>
            {tags.map(([tag, count], i) => <Checkbox key={i} my={5} value={tag} label={<Group justify="left">
                <Text inline>{tag}</Text><Text inline c="dimmed">({count})</Text>
            </Group>}></Checkbox>)}
        </Checkbox.Group>
    </>;
}

export default function Page() {
    const [clips, setClips] = useState<(Clip | undefined)[]>([]);
    const [selectedUmpires, setSelectedUmpires] = useState<string[]>([])
    const [selectedComps, setSelectedComps] = useState<string[]>([])
    const [selectedTags, setSelectedTags] = useState<string[]>([])


    const activeClips = useMemo(() => {
            const out = []
            for (const i of clips) {
                if (!i) continue
                let failed = false;
                for (const t of selectedTags) {
                    if (!i.categories?.includes(t)) {
                        failed = true;
                        break;
                    }
                }
                
                if (failed) continue;
                if (selectedComps.length > 0) {
                    if (!selectedComps.includes(i.game.competition.level)) {
                        continue
                    }
                }
                
                if (selectedUmpires.length > 0) {
                    const umpires = i.game.umpires.map(it => it.name);
                    failed = true;
                    for (const t of umpires) {
                        if (selectedUmpires?.includes(t)) {
                            failed = false;
                            break;
                        }
                    }
                    if (failed) continue;
                }
                out.push(i)
            }
            return out
        },
        [clips, selectedComps, selectedTags, selectedUmpires]
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
                    <TagSelector selectedUmpires={selectedUmpires} setSelectedUmpires={setSelectedUmpires}
                                 selectedTags={selectedTags} setSelectedTags={setSelectedTags} activeClips={activeClips}
                                 clips={clips} selectedComps={selectedComps} setSelectedComps={setSelectedComps}/>
                </Popover.Dropdown>
            </Popover>
        </Group>
        <Group align="flex-start">
            <Box w={{base: '100%', md: '80%'}}>
                <ClipsDisplay clips={activeClips}
                              setClips={setClips as Dispatch<SetStateAction<(Clip | undefined)[] | null>>} linkToGame
                              noClipMessage={
                                  <>There are no clips saved. <br/> Save a clip by
                                      pressing the star button in the top right!</>
                              }/>
            </Box>
            <Box visibleFrom='md'>
                <TagSelector selectedUmpires={selectedUmpires} setSelectedUmpires={setSelectedUmpires}
                             selectedTags={selectedTags} setSelectedTags={setSelectedTags} activeClips={activeClips}
                             clips={clips} selectedComps={selectedComps} setSelectedComps={setSelectedComps}/>
            </Box>
        </Group>
    </Flex>
}