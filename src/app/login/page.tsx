'use client'

import {useState} from "react";
import {Box, Button, Center, PasswordInput, Stack, TextInput, Title} from "@mantine/core";
import {useLocalStorage} from "react-use";
import Link from "next/link";

export default function LoginPage() {
    const [understand, setUnderstand] = useState(false);
    const [password, setPassword] = useLocalStorage("password", "");
    const [username, setUsername] = useLocalStorage("username", "");
    return <Box m={40}>
        <Center w="100%">
            <Title order={1}>THIS IS EXTREMELY IMPORTANT!</Title>
        </Center>
        <p>By using this page and giving me your password, you are putting a <b>SIGNIFICANT</b> amount of trust in
            me. Because of the way the internet is set up, it is impossible to log you in unless you <u>send your email
                and password to the server</u>. They are never stored, and are essentially immediately forwarded to
            LiveHockey, but as mentioned above, you are placing a lot of trust in me to fulfil these promises.
            This is <b>NOT</b> something you should feel comfortable doing unless you know me personally <i>(well
                enough
                that you can find me and make me pay if I steal your password!)</i></p>

        {understand ? <Center w="100%">
            <Stack h={500} gap="lg" w={"80%"}>
                <TextInput label="Username" value={username} onChange={e => setUsername(e.target.value)}
                           w="100%"
                           placeholder="Your LiveHockey email here"></TextInput>
                <PasswordInput label="Password" w="100%" value={password} onChange={e => setPassword(e.target.value)}
                               placeholder="Your LiveHockey password here"></PasswordInput>
                <Link href="/"><Button bg="green" disabled={!username || !password}>Submit</Button></Link>
            </Stack>
        </Center> : <Button onClick={() => setUnderstand(true)}> I understand!</Button>}
    </Box>
}