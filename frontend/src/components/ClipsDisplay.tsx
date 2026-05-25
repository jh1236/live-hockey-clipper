import {Clip, SERVER_ADDRESS} from "@/serverTypes";
import {
    ActionIcon,
    AspectRatio,
    Badge,
    Box,
    Button,
    Card,
    Center,
    Checkbox,
    Flex,
    Grid,
    Group,
    Loader,
    Menu,
    Modal,
    Paper,
    Popover,
    Skeleton,
    Stack,
    TagsInput,
    Text,
    TextInput
} from "@mantine/core";
import {hmsToSecondsOnly, secondsToHMS} from "@/utils";
import Link from "next/link";
import {FaArrowUpRightFromSquare, FaFloppyDisk, FaMinus, FaPencil, FaTrash, FaTv} from "react-icons/fa6";
import {FaEllipsisH, FaFileDownload} from "react-icons/fa";
import {Dispatch, SetStateAction, useMemo, useState} from "react";
import {useSetting} from "@/components/settings";
import {useBoolean} from "react-use";

const CATEGORIES = [
    'Stick Obstruction',
    'Body Obstruction',
    'Aerial',
    'Penalty Corner',
    'Penalty Stroke',
    'Positioning',
    'Green Card',
    'Yellow Card',
    '10 Minute Yellow Card',
] as const


function LoadingClip() {
    const [simplified] = useSetting('useSimplified')
    return <Card shadow="sm" padding="lg" withBorder>
        <Card.Section p={10}>
            <Center>
                <Skeleton height={12} w="80%"/>
            </Center>
        </Card.Section>
        <Card.Section mb={10}>
            <AspectRatio ratio={16 / 9} maw={400} mx="auto" pos="relative" bg="#222222">
                <Skeleton w="100%" h="100%" radius="sm"></Skeleton>
            </AspectRatio>
        </Card.Section>

        <Skeleton height={12} w="20%" mb={6}/>
        <Skeleton height={8} w="80%" mb={12}/>
        <Skeleton height={12} w="20%" mb={6}/>
        <Skeleton height={8} w="80%"/>


        {!simplified && <Group w="100%" justify="space-around">
            <ActionIcon disabled hiddenFrom="md" size="lg" color="blue" mt={5}>
                <FaArrowUpRightFromSquare/>
            </ActionIcon>
            <Button disabled visibleFrom="md" color="blue" mt={5}>
                Open in new tab
            </Button>
            <ActionIcon disabled hiddenFrom="md" size="lg" color="blue" mt={5}>
                <FaFileDownload/>
            </ActionIcon>
            <Button disabled visibleFrom="md" color="blue" mt={5}>
                Download
            </Button>
        </Group>}

    </Card>
}

interface LoadedCardProps {
    clip: Clip | undefined,
    setEditingClipIndex: Dispatch<SetStateAction<number>>,
    setClips: Dispatch<SetStateAction<(Clip | undefined)[] | null>>,
    clipIndex: number,
    linkToGame: boolean
}

function SingleClipDisplay({clip, setEditingClipIndex, clipIndex, setClips, linkToGame}: LoadedCardProps) {
    const [simplified] = useSetting('useSimplified')
    const [menuOpen, setMenuOpen] = useBoolean(false);
    if (!clip) {
        return <LoadingClip/>
    }
    return <>
        <Card shadow="sm" p={10} pt={0} withBorder>
            <Box right={0} pos="absolute" m={5}>
                {simplified ?
                    <Box>
                        <Menu opened={menuOpen} onChange={setMenuOpen} trigger="click" closeOnItemClick={false}>
                            <Menu.Target>
                                <ActionIcon
                                    variant="filled"
                                    color="gray">
                                    <FaEllipsisH/>
                                </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Item
                                    component="a"
                                    href={clip.link}
                                    target="_blank"
                                    onClick={() => setMenuOpen(false)}
                                    leftSection={<FaFileDownload size={14}/>}
                                >
                                    Open in new tab
                                </Menu.Item>
                                <Menu.Item
                                    component="a"
                                    onClick={() => setMenuOpen(false)}
                                    href={`${clip.link}?download=true`}
                                    target="_blank"
                                    leftSection={<FaFileDownload size={14}/>}
                                >
                                    Download
                                </Menu.Item>

                                <Menu.Item
                                    leftSection={clip.favourite ? <FaPencil size={14}/> :
                                        <FaFloppyDisk size={14}/>}
                                    onClick={() => {
                                        setMenuOpen(false)
                                        setEditingClipIndex(clipIndex)
                                    }}
                                >
                                    {clip.favourite ? 'Edit' : 'Save'}
                                </Menu.Item>
                                <Popover position="right-start" withArrow arrowPosition="center">
                                    <Popover.Target>
                                        <Menu.Item
                                            color="red"
                                            onClick={e => e.preventDefault()}
                                            disabled={clip.favourite}
                                            leftSection={<FaTrash size={14}/>}
                                        >
                                            Delete
                                        </Menu.Item>
                                    </Popover.Target>
                                    <Popover.Dropdown w={200}>
                                        <Stack align="center" justify="left" gap={0}>
                                            {clip.favourite ?
                                                <>
                                                    <Text fs="italic" ta="center" m={0}>Saved clips cannot be
                                                        deleted.</Text>
                                                    <Text fs="italic" ta="center" m={0}>Unsave the clip first.</Text>
                                                </> :
                                                <>
                                                    <Text fw={600} ta="center" m={0}>Are you sure you want to
                                                        delete?</Text>
                                                    <Text fw={600} ta="center" m={0}>This cannot be undone!</Text>
                                                    <Button
                                                        mt={5}
                                                        color="red"
                                                        onClick={() => {
                                                            fetch(`${SERVER_ADDRESS}/api/clips/remove`, {
                                                                headers: {
                                                                    'Content-Type': "application/json",
                                                                },
                                                                method: 'DELETE',
                                                                body: JSON.stringify({
                                                                    id: clip?.id
                                                                })
                                                            }).then(() => {
                                                                setClips(prev => prev!.filter((it) => it?.id === clip?.id))
                                                            })
                                                        }}>
                                                        Yes
                                                    </Button>
                                                </>
                                            }
                                        </Stack>
                                    </Popover.Dropdown>
                                </Popover>
                            </Menu.Dropdown>
                        </Menu>

                    </Box> :
                    <Box>
                        {
                            clip?.favourite ?
                                <ActionIcon
                                    m={5}
                                    variant="filled"
                                    color="green"
                                    onClick={() => setEditingClipIndex(clipIndex)}>
                                    <FaPencil/>
                                </ActionIcon> :
                                <ActionIcon
                                    m={5}
                                    loading={clip?.favourite === undefined}
                                    variant="filled"
                                    color="yellow"
                                    onClick={() => setEditingClipIndex(clipIndex)}>
                                    <FaFloppyDisk/>
                                </ActionIcon>
                        }
                        <Popover>
                            <Popover.Target>
                                <ActionIcon
                                    m={5}
                                    variant="filled"
                                    color={clip.favourite ? "dimmed" : "red"}
                                >
                                    <FaMinus/>
                                </ActionIcon>
                            </Popover.Target>
                            <Popover.Dropdown w={200}>
                                <Stack align="center" justify="left" gap={0}>
                                    {clip.favourite ?
                                        <>
                                            <Text fs="italic" ta="center" m={0}>Saved clips cannot be deleted.</Text>
                                            <Text fs="italic" ta="center" m={0}> Unsave the clip first.</Text>
                                        </> :
                                        <>
                                            <Text fw={600} ta="center" m={0}>Are you sure you want to delete?</Text>
                                            <Text fw={600} ta="center" m={0}>This cannot be undone!</Text>
                                            <Button
                                                mt={5}
                                                color="red"
                                                onClick={() => {
                                                    setClips(prev => prev!.filter((_, i) => i !== clipIndex))
                                                    fetch(`${SERVER_ADDRESS}/api/clips/remove`, {
                                                        headers: {
                                                            'Content-Type': "application/json",
                                                        },
                                                        method: 'DELETE',
                                                        body: JSON.stringify({
                                                            id: clip?.id
                                                        })
                                                    })
                                                }}>
                                                Yes
                                            </Button>
                                        </>
                                    }
                                </Stack>
                            </Popover.Dropdown>
                        </Popover>
                    </Box>
                }
            </Box>
            <Card.Section mb={10}>
                {clip?.link ?
                    <video src={clip.link} controls width="100%"></video> :
                    <>
                        <AspectRatio ratio={16 / 9} maw={400} mx="auto" pos="relative" bg="#222222">
                            <Flex justify="center" align="center"><Loader z={1000}></Loader></Flex>
                        </AspectRatio>
                    </>

                }
            </Card.Section>
            <Text fz="1.1em" fw={600}
                  ta="center"
                  fs={!clip?.favourite ? 'italic' : undefined}>{clip?.name ?? 'Loading...'}{clip?.favourite ? '' : '*'}</Text>
            {!!clip?.categories?.length && <Group my={10}>
                {clip?.categories?.map(it => <Badge color="blue" key={it}>{it}</Badge>)}
            </Group>}
            <Text size="sm" c="dimmed" mb={5} ta="left">
                <b>Timecode:</b>
                <br/>{clip.timecode} - {secondsToHMS(hmsToSecondsOnly(clip.timecode) + hmsToSecondsOnly(clip.length))}
            </Text>


            {!simplified &&
                <Group w="100%" justify="space-around">
                    <Link href={clip.link} target="_blank">
                        <ActionIcon hiddenFrom="md" size="lg" color="blue" mt={5}>
                            <FaTv/>
                        </ActionIcon>
                        <Button visibleFrom="md" color="blue" mt={5}>
                            Open in new tab
                        </Button>
                    </Link>
                    {linkToGame ?
                        <Link href={`/${clip.gameBlob}`} target="_blank">
                            <ActionIcon hiddenFrom="md" size="lg" color="blue" mt={5}>
                                <FaArrowUpRightFromSquare/>
                            </ActionIcon>
                            <Button visibleFrom="md" color="blue" mt={5}>
                                View Game
                            </Button>
                        </Link> : <Link download href={`${clip.link}?download=true`} target="_blank">
                            <ActionIcon hiddenFrom="md" size="lg" color="blue" mt={5}>
                                <FaFileDownload/>
                            </ActionIcon>
                            <Button visibleFrom="md" color="blue" mt={5}>
                                Download
                            </Button>
                        </Link>}
                </Group>
            }
        </Card>
    </>
        ;
}

interface ClipsDisplayProps {
    clips: (Clip | undefined)[] | null,
    setClips
        :
        Dispatch<SetStateAction<(Clip | undefined)[] | null>>,
    error?: string,
    noClipMessage
        :
        string | React.ReactElement,
    linkToGame?: boolean
}

export function ClipsDisplay({
                                 clips, setClips, noClipMessage, linkToGame = false
                             }: ClipsDisplayProps) {
    const [categories, setCategories] = useState<string[]>([])
    const [shouldBeSaved, setShouldBeSaved] = useState<boolean>(true);
    const [nameOfSavedClip, setNameOfSavedClip] = useState<string>("");
    const [editClipIdx, setEditClipIdx] = useState<number>(-1)
    const clipNameError = !nameOfSavedClip || (clips?.filter((it, i) => i !== editClipIdx && it !== undefined && it.gameBlob === clips[editClipIdx]?.gameBlob)?.map(it => it!.name).includes(nameOfSavedClip));

    const clipBeingEdited = useMemo(() => clips?.[editClipIdx], [editClipIdx, clips])

    if (!clips) {
        return <Grid flex={3} w="100%" p={20} overflow="scroll">
            {Array.from({length: 5}).map((_, i) => <Grid.Col key={i} span={{
                base: 6,
                md: 3
            }}>
                <LoadingClip/>
            </Grid.Col>)}
        </Grid>
    }

    const editExistingClip = <><TextInput
        w="100%"
        mb={10}
        withAsterisk
        label="Clip title"
        description="File name for this clip"
        placeholder={shouldBeSaved ? '' : '<Unset>'}
        error={!nameOfSavedClip ?
            "You must provide a name for the clip! " :
            clipNameError ? `The name '${nameOfSavedClip}' is already in use!` : undefined}
        disabled={!shouldBeSaved}
        value={shouldBeSaved ? nameOfSavedClip : ''}
        onChange={e => setNameOfSavedClip(e.target.value)}/>
        <TagsInput w="100%" mb={10} withAsterisk label="Clip Categories" value={shouldBeSaved ? categories : []}
                   disabled={!shouldBeSaved}
                   onChange={setCategories}
                   placeholder={shouldBeSaved ? 'Add tags' : '<Unset>'}
                   data={CATEGORIES}/>
        {clipBeingEdited?.favourite && <Checkbox
            mb={10}
            description="Clip may be deleted if not checked"
            checked={shouldBeSaved}
            onChange={e => setShouldBeSaved(e.target.checked)}
            label="Should this game be saved?"
        />}
        <Button mb={10} onClick={() => {
            const oldValue = clips[editClipIdx]!;
            setClips!(prev => prev!.map((clip, idx) => editClipIdx === idx ? undefined : clip) ?? null)
            fetch(`${SERVER_ADDRESS}/api/clips/edit`, {
                method: 'POST',
                headers: {
                    'Content-Type': "application/json",
                },
                body: JSON.stringify({
                    clipName: nameOfSavedClip, //ignored when not saved
                    id: oldValue.id,
                    favourite: shouldBeSaved,
                    categories, //ignored when not saved
                    gameBlob: oldValue.gameBlob
                })
            }).then(it => it.json()).then(({clip}) => {
                setClips!(prev => prev!.map((it, i, arr) => (arr.indexOf(undefined) === i || it?.id === clip.id) ? clip : it))
            })
            setEditClipIdx(-1)
        }} disabled={!categories.length || !nameOfSavedClip || clipNameError}>
            {!shouldBeSaved && 'Un'}Save
        </Button></>;
    return <>
        {clips.length ? <>
            <Modal centered opened={clipBeingEdited !== undefined} onClose={() => setEditClipIdx(-1)}
                   title="Save Clip" w="auto">
                {editExistingClip}
            </Modal>
            <Grid flex={3} w="100%" h="80%" p={20} overflow="scroll">
                {clips.map((it, i) =>
                    <Grid.Col key={(it?.id ?? -i)} span={{
                        base: 6,
                        md: 3
                    }}>
                        <SingleClipDisplay
                            clip={it}
                            linkToGame={linkToGame}
                            setClips={setClips}
                            setEditingClipIndex={(value) => {
                                setNameOfSavedClip(it?.name ?? '')
                                setCategories(it?.categories ?? [])
                                setEditClipIdx(value)
                                setShouldBeSaved(true)
                            }}
                            clipIndex={i}/>
                    </Grid.Col>)}
            </Grid>
        </> : <Paper h="80%" ta="center">
            <Flex direction="column" h="100%" justify="center" p={30}>
                <Text fs="italic" c="dimmed">{noClipMessage}</Text>
            </Flex>
        </Paper>}
    </>;
}