import {FFmpeg} from "@ffmpeg/ffmpeg";
import {fetchFile} from "@ffmpeg/util";
import {downloadZip} from "client-zip";
import {Clip, getLinkFromBlob} from "@/ServerClipManager";
import {hmsToSecondsOnly} from "@/utils";

export async function downloadOneClip(ffmpeg: FFmpeg, blob: string, token: string, timecode: string, length: string): Promise<string> {
    const link = await getLinkFromBlob(blob, token)
    const index = await fetch(link);
    const text = await index.text();

    let prevTime = 0;
    let currentTime = 0;
    let firstTime: number | null = null;
    const files: string[] = [];

    for (const line of text.split("\n")) {
        if (line.startsWith("#EXTINF:")) {
            prevTime = currentTime;
            currentTime += +line.split("#EXTINF:")[1].split(",")[0];
        } else if (currentTime > hmsToSecondsOnly(timecode) && prevTime < hmsToSecondsOnly(timecode) + hmsToSecondsOnly(length)) {
            if (firstTime === null) {
                firstTime = prevTime;
            }
            if (line.trim().length > 0 && !line.startsWith("#")) {
                files.push(line);
            }
        }
    }

    const listFile = files.map((url, i) => {
        const name = `file${i}.ts`;
        return {url, name};
    });

    for (const f of listFile) {
        const data = await fetchFile(f.url);
        await ffmpeg.writeFile(f.name, data);
    }

    const concatTxt = listFile.map((f) => `file '${f.name}'`).join("\n");
    await ffmpeg.writeFile("list.txt", concatTxt);

    // Run ffmpeg (use exec instead of run)
    await ffmpeg.exec([
        "-f", "concat",
        "-safe", "0",
        "-ss", (hmsToSecondsOnly(timecode) - (firstTime ?? 0)).toString(),
        "-t", length.toString(),
        "-i", "list.txt",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", "veryfast",
        "-crf", "23",
        "-fflags", "+genpts",
        "output.mp4",
    ]);

    const data = await ffmpeg.readFile("output.mp4") as any;
    return URL.createObjectURL(
        new Blob([data.buffer], {type: "video/mp4"})
    );
}


export async function downloadMultipleClips(
    ffmpeg: FFmpeg,
    blob: string,
    token: string,
    clips: Clip[],
    filename: string = 'clips'): Promise<Blob> {
    const link: string = await getLinkFromBlob(blob, token)
    const indexFile = await fetch(link);
    const text = await indexFile.text();


    let prevTime = 0;
    let currentTime = 0;
    const allFiles: string[] = [];
    const filesForClip: number[][] = clips.map(() => []);

    for (const line of text.split("\n")) {
        if (line.startsWith("#EXTINF:")) {
            prevTime = currentTime;
            currentTime += +line.split("#EXTINF:")[1].split(",")[0];
        }
        let clipUsed = false;
        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            console.log(`${currentTime} vs ${hmsToSecondsOnly(clip.timecode)}`)
            if (currentTime > hmsToSecondsOnly(clip.timecode) && prevTime <= hmsToSecondsOnly(clip.timecode) + hmsToSecondsOnly(clip.length)) {
                if (line.trim().length > 0 && !line.startsWith("#")) {
                    filesForClip[i].push(allFiles.length);
                    clipUsed = true;
                }
            }
        }
        if (clipUsed) {
            allFiles.push(line);
        }

    }

    const listFile = allFiles.map((url, i) => {
        const name = `file${i}.ts`;
        return {url, name};
    });
    const tasks = []
    for (const f of listFile) {
        const data = await fetchFile(f.url);
        tasks.push(ffmpeg.writeFile(f.name, data));
    }
    await Promise.all(tasks)
    const out = []
    for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const myFiles = filesForClip[i];
        if (myFiles.length === 0) continue;
        const concatTxt = myFiles.map((j) => `file 'file${j}.ts'`).join("\n");
        console.log(0)
        await ffmpeg.writeFile(`list${i}.txt`, concatTxt);
        // Run ffmpeg (use exec instead of run)
        console.log(1)
        await ffmpeg.exec([
            "-f", "concat",
            "-safe", "0",
            "-i", `list${i}.txt`,
            "-c", "copy",
            "concat.ts",
        ]);
        console.log(2)
        await ffmpeg.readFile("concat.ts");
        console.log(3)
        await ffmpeg.exec([
            "-i", "concat.ts",
            "-ss", (hmsToSecondsOnly(clip.timecode) % 6).toString(),
            "-t", hmsToSecondsOnly(clip.length).toString(),
            "-c", "copy",
            `output${i}.mp4`,
        ]);
        console.log(4)

        const data = await ffmpeg.readFile(`output${i}.mp4`) as any;
        out.push({name: `${clip.name ?? `clip${i}`}.mp4`, input: data});
    }
    return downloadZip(out).blob();
}
