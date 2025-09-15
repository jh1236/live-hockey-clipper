"use client";

import {FFmpeg} from "@ffmpeg/ffmpeg";
import {toBlobURL} from "@ffmpeg/util";
import {useEffect, useRef, useState} from "react";
import {downloadMultipleClips, hmsToSecondsOnly} from "@/ClipManager";
import Image from "next/image";


export default function Home() {
    const [loaded, setLoaded] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [clips, setClips] = useState<{
        timecode: string,
        length: string,
        name: string,
    }[]>([]);
    const [gameUUID, setGameUUID] = useState<string>("");
    const [homeTeamImage, setHomeTeamImage] = useState<string>("/blank.png");
    const [awayTeamImage, setAwayTeamImage] = useState<string>("/blank.png");
    const [gameName, setGameName] = useState<string>("Enter a link to load a game");
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const messageRef = useRef<HTMLParagraphElement | null>(null);
    const videoNumberRef = useRef<number>(0);
    const elapsedTimeRef = useRef<number>(0);


    useEffect(() => {
        ffmpegRef.current = new FFmpeg();
        load();
    }, []);

    const clipsRef = useRef(clips);
    useEffect(() => {
        clipsRef.current = clips;
    }, [clips]);

    useEffect(() => {
        if (gameUUID) {
            setGameName("Loading...")
            fetch(`/api/broadcast/${gameUUID}`)
                .then((res) => res.json())
                .then((o) => {
                    setGameName(`${o.competition.name}: ${o.homeTeam.shortName} vs ${o.awayTeam.shortName}`)
                    setHomeTeamImage(`https://files.livearenasports.com/files/${o.homeTeam.logo.blobId}`);
                    setAwayTeamImage(`https://files.livearenasports.com/files/${o.awayTeam.logo.blobId}`);
                })
                .catch(() => setGameName("Error"));
        }
    }, [gameUUID]);

    const load = async () => {
        setIsRunning(true);
        const baseURL =
            "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
        const ffmpeg = ffmpegRef.current;
        ffmpeg!.on("log", ({message}) => {
            if (message.includes("time=")) {
                const timeString = message.split("time=")[1].split(" ")[0]
                const decimal = +`0.${timeString.split(".")[1]}`;
                const time = hmsToSecondsOnly(timeString.split(".")[0]) + decimal;
                if (time < 0 || time > hmsToSecondsOnly(clipsRef.current[videoNumberRef.current - 1].length)) return;
                if (time < elapsedTimeRef.current!) {
                    videoNumberRef.current += 1;
                }
                elapsedTimeRef.current = time;
                if (messageRef.current) {
                    messageRef.current.innerHTML = `Video ${videoNumberRef.current}: ${Math.round(time / hmsToSecondsOnly(clipsRef.current[videoNumberRef.current - 1].length) * 10000) / 100}%`;
                }
            }
        });
        await ffmpeg!.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        setLoaded(true);
        setIsRunning(false);
    };


    return loaded ? (
        <div className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]">
            <h1>{gameName}</h1>
            <div>
                <label htmlFor="link">Link: </label>
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <Image src={homeTeamImage} alt="Home team image" width={200} height={200}/>
                    <Image src={awayTeamImage} alt="Away team image" width={200} height={200}/>
                </div>
                <input
                    id="link"
                    style={{backgroundColor: "white", color: "black", width: "100%"}}
                    type="text"
                    value={gameUUID}
                    onChange={(e) => setGameUUID(e.target.value.replace(/.*\/game\//, ""))}
                />
                <br/>
                <br/>
                {clips.map((clip, index) => (
                    <div key={index} style={{display: "flex", justifyContent: "space-between", width: 600}}>
                        <div>
                            <label htmlFor="clipTime">Start Time: </label>
                            <input id="clipTime" type="text"
                                   value={clip.timecode}
                                   style={{backgroundColor: "white", color: "black", maxWidth: 150}}
                                   onChange={(e) => {
                                       setClips(clips.map((c, i) => i !== index ? c : {
                                           length: clip.length,
                                           timecode: e.target.value,
                                           name: clip.name
                                       }))
                                   }}/>
                        </div>
                        <div>
                            <label htmlFor="clipLength">Length: </label>
                            <input id="clipLength" type="text"
                                   value={clip.length}
                                   style={{backgroundColor: "white", color: "black", maxWidth: 150}}
                                   onChange={(e) => {
                                       setClips(clips.map((c, i) => i !== index ? c : {
                                           length: e.target.value,
                                           timecode: clip.timecode,
                                           name: clip.name
                                       }))
                                   }}/>
                        </div>
                        <div>
                            <label htmlFor="clipName">Name: </label>
                            <input id="clipName" type="text"
                                   value={clip.name}
                                   style={{backgroundColor: "white", color: "black", maxWidth: 150}}
                                   onChange={(e) => {
                                       setClips(clips.map((c, i) => i !== index ? c : {
                                           length: clip.length,
                                           timecode: clip.timecode,
                                           name: e.target.value
                                       }))
                                   }}/>
                        </div>
                        <br/>
                        <br/>

                    </div>
                ))}
                <br/>
                <button onClick={() => setClips([...clips].concat({
                    length: "0",
                    timecode: "0",
                    name: `clip ${clips.length}`
                }))}
                        className="bg-green-500 hover:bg-green-700 text-white py-3 px-6 rounded"
                >Add Clip
                </button>
                <br/>
                <br/>
                <button
                    disabled={isRunning}
                    onClick={() => {
                        setIsRunning(true);
                        elapsedTimeRef.current = 0;
                        videoNumberRef.current = 1;
                        if (messageRef.current) {
                            messageRef.current.innerHTML = "Searching for video file...";
                        }
                        downloadMultipleClips(ffmpegRef.current!, gameUUID, clips).then(blob => {
                            const link = document.createElement("a")
                            link.href = URL.createObjectURL(blob)
                            link.download = "test.zip"
                            link.click()
                            link.remove()
                        }).then(() => {
                            setIsRunning(false)
                            messageRef.current!.innerHTML = "Done!"
                        });
                    }}
                    className="bg-green-500 hover:bg-green-700 text-white py-3 px-6 rounded"
                >
                    Execute
                </button>
                <p ref={messageRef}></p>
            </div>
        </div>
    ) : (
        <h1>Loading...</h1>
    );
}
