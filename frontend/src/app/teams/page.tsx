'use client'

import {Box, Button, Group, Select, Table, Text, TextInput, Title} from "@mantine/core";
import {Dispatch, SetStateAction, useEffect, useState} from "react";
import {SERVER_ADDRESS, Team} from "@/serverTypes";

interface TeamRowParams {
    team: Team;
    name: string;
    setTeams: Dispatch<SetStateAction<{ [key: string]: Team }>>;
}

function TeamRow({team, name, setTeams}: TeamRowParams) {
    const [loading, setLoading] = useState<boolean>(false)
    const [imageLink, setImageLink] = useState<string>(team.imageLink ?? '')
    return <Table.Tr m={40}>
        <Table.Td>
            <Text ta="center" fz="1.5em" c={!team.imageLink ? 'red' : undefined}>{name}</Text>
        </Table.Td>
        <Table.Td>
            <Group>
                <TextInput w="60%" loading={loading} value={imageLink} onChange={e => setImageLink(e.target.value)}>

                </TextInput>
                <Button loading={loading} color="green" onClick={() => {
                    setLoading(true)
                    fetch(`${SERVER_ADDRESS}/api/teams/set_image`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': "application/json",
                        },
                        body: JSON.stringify({team: name, imageLink: imageLink})
                    }).catch(e => console.log(e))
                        .then(_ => setTeams(prev => {
                            setLoading(false)
                            return {
                                ...prev, [name]: {...team, imageLink: imageLink}
                            }
                        }))
                }}>
                    Submit
                </Button>
            </Group>
        </Table.Td>
    </Table.Tr>;
}

export default function Page() {

    const [teams, setTeams] = useState<{ [key: string]: Team }>({});
    useEffect(() => {
        fetch(`${SERVER_ADDRESS}/api/teams/`).then(res => res.json()).then(res => {
            setTeams(res)
        });
    }, []);
    return <Box m={40}>
        <Title>Set genders for umpires</Title>
        <Table w="100%">
            <Table.Tbody>
                {Object.entries(teams).map(([name, team], i) =>
                    <TeamRow key={i} team={team} name={name} setTeams={setTeams}/>
                )}
            </Table.Tbody>
        </Table>
    </Box>
}