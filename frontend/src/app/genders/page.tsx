'use client'

import {Box, Select, Table, Text, Title} from "@mantine/core";
import {useEffect, useState} from "react";
import {SERVER_ADDRESS} from "@/serverTypes";

export default function Page() {

    const [genders, setGenders] = useState<{ [key: string]: 'M' | 'F' | '?' }>({});
    const [loading, setLoading] = useState<{ [key: string]: boolean }>({})
    useEffect(() => {
        fetch(`${SERVER_ADDRESS}/api/umpires/genders`).then(res => res.json()).then(res => {
            setGenders(res)
            setLoading(Object.fromEntries(Object.keys(res).entries().map(([k]) => [k, false])))
        });
    }, []);
    return <Box m={40}>
        <Title>Set genders for umpires</Title>
        <Table w="100%">
            {Object.entries(genders).map(([umpire, gender], i) =>
                <Table.Tr key={i} m={40}>
                    <Table.Td>
                        <Text ta="center" fz="1.5em" c={gender === '?' ? 'red' : undefined}>{umpire}</Text>
                    </Table.Td>
                    <Table.Td>
                        <Select ta="center" value={gender} data={['M', 'F', '?']}
                                maw={100}
                                loading={loading[umpire]}
                                onChange={e => {
                                    setLoading(prev => ({...prev, [umpire]: true}))
                                    fetch(`${SERVER_ADDRESS}/api/umpires/set_gender`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': "application/json",
                                        },
                                        body: JSON.stringify({umpire, gender: e})
                                    }).catch(e => console.log(e))
                                        .then(_ => setGenders(prev => {
                                            setLoading(prev => ({...prev, [umpire]: false}))
                                            return {
                                                ...prev, [umpire]: e as typeof genders[string]
                                            }
                                        }))
                                }}
                        />
                    </Table.Td>
                </Table.Tr>
            )}
        </Table>
    </Box>
}