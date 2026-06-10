'use client'

import {BarChart, PieChart} from "@mantine/charts";
import {Grid, Group, Select, Table, Text, Title} from "@mantine/core";
import {Dispatch, SetStateAction, useCallback, useMemo} from "react";
import {UmpireStatsResponse} from "@/serverTypes";
import {COLORS, defs} from "@/graphUtils";
import {levelComparer} from "@/components/AllUmpiresGraphs";
import {urlFix} from "@/components/UmpireManagerGraph";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {AllGrades} from "@/components/pages/StatisticsPage";


interface UmpireGraphsParams {
    fromYear: number;
    toYear: number;
    level: AllGrades;
    gender: 'M' | 'F' | '-';
    umpireData: UmpireStatsResponse[];
    pieChart: boolean;
    setPieChart: Dispatch<SetStateAction<boolean>>;
}


const teamDefs = <>
    <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
            <pattern id="FCHC" width="20" height="20" patternTransform="rotate(45)scale(0.5)"
                     patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%"/>
                <path fill="none" stroke="#e0e0e0" strokeWidth="7.5" d="M0 10h20z"/>
            </pattern>
            <pattern id="MEL" width="40" height="40" patternUnits="userSpaceOnUse"
                     patternTransform="rotate(45)scale(0.25)">
                <rect width="100%" height="100%" fill="#52001b"/>
                <path fill="#fff" d="M11 6a5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5 5 5 0 0 1 5 5"/>
            </pattern>
            <pattern id="UWA" width="20" height="20" patternTransform="scale(0.5)" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#e67e00"/>
                <path fill="#006603"
                      d="M0-10C-.011-4.49-4.485.03-10 .03-4.485.03-.011 4.49 0 10 .011 4.498 4.493.001 10-.01 4.493-.02.012-4.498 0-10m0 20c-.011 5.51-4.485 10.03-10 10.03 5.515 0 9.989 4.46 10 9.97.011-5.502 4.493-9.999 10-10.01C4.493 19.98.012 15.502 0 10m20-20C19.989-4.49 15.515.03 10 .03c5.515 0 9.989 4.46 10 9.97.011-5.502 4.493-9.999 10-10.01-5.507-.01-9.988-4.488-10-9.99m0 20c-.011 5.51-4.485 10.03-10 10.03 5.515 0 9.989 4.46 10 9.97.011-5.502 4.493-9.999 10-10.01-5.507-.01-9.988-4.488-10-9.99"/>
                <path fill="#006603"
                      d="M10 0C9.989 5.51 5.515 10.03 0 10.03c5.515 0 9.989 4.46 10 9.97.011-5.502 4.493-9.998 10-10.01-5.507-.01-9.988-4.488-10-9.99"/>
            </pattern>
            <pattern id="WASPS" width="60" height="60" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#ecc94b"/>
                <path fill="none" stroke="#008f1d" strokeWidth="2"
                      d="M10 60V30m10 0v30m10 0H0V30M50 0v30m-10 0V0M30 0h30v30M30 40h30m0 10H30m0-20h30v30H30zM0 10h30m0 10H0M0 0h30v30H0z"/>
            </pattern>
            <pattern id="WOL" width="100" height="100" patternTransform="rotate(5)" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#858585"/>
                <path fill="#F00"
                      d="M100.16 24.75a2.93 2.93 0 1 1 .04 5.86 2.93 2.93 0 0 1-2.95-2.91 2.92 2.92 0 0 1 2.9-2.95zm-100 0a2.93 2.93 0 1 1 .04 5.86 2.93 2.93 0 0 1-2.95-2.91 2.92 2.92 0 0 1 2.9-2.95zm9.57 53.18c1.6 0 2.9 1.3 2.9 2.9a2.95 2.95 0 0 1-2.95 2.96 2.9 2.9 0 0 1-2.9-2.9 2.95 2.95 0 0 1 2.95-2.96m58.57-2.51a2.93 2.93 0 1 1 .04 5.86 2.93 2.93 0 1 1-.04-5.86M49.45 4.4a2.93 2.93 0 1 1 .04 5.86 2.93 2.93 0 0 1-.04-5.86M21.66 49.6l2.95 2.91-2.9 2.95-2.95-2.9zm43.55-12.85s2.9 1.3 2.9 2.9v.05c0 1.6-1.3 2.9-2.9 2.9h-.04c-1.6 0-2.9-2.9-2.9-2.9zm24.72 20.73a1.08 1.08 0 0 1 .39-1.38c2.44-1.53 5.04-1.81 7.15-.8 2.1 1.03 3.47 3.26 3.77 6.13.22 2.14 1.14 3.71 2.58 4.42 1.44.7 3.24.45 5.07-.69a1.07 1.07 0 0 1 1.13 1.8c-2.44 1.54-5.04 1.83-7.14.81s-3.48-3.25-3.77-6.12c-.23-2.15-1.15-3.72-2.59-4.42s-3.24-.46-5.07.68c-.5.32-1.16.16-1.47-.33zm10.06 31.11a.87.87 0 0 1 1.07.46c.99 2.14.95 4.28-.1 5.88s-3 2.48-5.36 2.42c-1.76-.04-3.13.54-3.85 1.63-.72 1.1-.71 2.59.03 4.18a.87.87 0 1 1-1.59.73c-.99-2.13-.95-4.27.1-5.87s3-2.48 5.36-2.42c1.76.04 3.13-.54 3.85-1.63.72-1.1.71-2.59-.03-4.18a.87.87 0 0 1 .52-1.2m0-100a.87.87 0 0 1 1.07.46c.99 2.14.95 4.28-.1 5.88s-3 2.48-5.36 2.42c-1.76-.04-3.13.54-3.85 1.63-.72 1.1-.71 2.59.03 4.18a.87.87 0 1 1-1.59.73c-.99-2.13-.95-4.27.1-5.87s3-2.48 5.36-2.42c1.76.04 3.13-.54 3.85-1.63.72-1.1.71-2.59-.03-4.18a.87.87 0 0 1 .52-1.2M9.44 9.9c.15-.3.54-.39.9-.24 1.88.82 3.16 2.12 3.53 3.58.38 1.47-.21 2.93-1.6 4.02-1.04.8-1.47 1.81-1.22 2.81.26 1 1.17 1.9 2.57 2.5.39.18.6.58.47.9-.13.34-.55.47-.93.3-1.88-.82-3.16-2.12-3.54-3.58-.37-1.46.22-2.93 1.6-4.01 1.05-.81 1.48-1.82 1.23-2.82-.26-1-1.17-1.89-2.58-2.5-.38-.17-.59-.57-.46-.9l.03-.07zm-19.51 47.59a1.08 1.08 0 0 1 .39-1.38c2.44-1.53 5.04-1.81 7.15-.8 2.1 1.03 3.47 3.26 3.77 6.13.22 2.14 1.14 3.71 2.58 4.42 1.44.7 3.24.45 5.07-.69a1.07 1.07 0 0 1 1.13 1.8c-2.44 1.54-5.04 1.83-7.14.81C.78 66.75-.6 64.52-.9 61.65c-.23-2.15-1.15-3.72-2.59-4.42s-3.24-.46-5.07.68c-.5.32-1.16.16-1.47-.33l-.05-.1zm10.06 31.1a.87.87 0 0 1 1.07.46c.99 2.14.95 4.28-.1 5.88s-3 2.48-5.36 2.42c-1.76-.04-3.13.54-3.85 1.63-.72 1.1-.71 2.59.03 4.18a.87.87 0 1 1-1.59.73c-.99-2.13-.95-4.27.1-5.87s3-2.48 5.36-2.42c1.76.04 3.13-.54 3.85-1.63.72-1.1.71-2.59-.03-4.18a.87.87 0 0 1 .52-1.2m43.92-4.85c-.24-.48-.1-1.08.36-1.38 2.41-1.59 5-1.93 7.13-.96s3.55 3.17 3.92 6.03c.27 2.14 1.23 3.7 2.68 4.36 1.46.67 3.25.38 5.05-.8a1.07 1.07 0 0 1 1.48.3c.32.5.19 1.16-.3 1.48-2.4 1.59-5 1.94-7.13.96-2.12-.97-3.55-3.17-3.91-6.03-.28-2.14-1.23-3.69-2.69-4.36s-3.25-.38-5.05.8c-.49.32-1.16.2-1.48-.3zM41 45.67c-.47.25-1.07.1-1.38-.35-1.61-2.39-2-4.98-1.05-7.11.94-2.14 3.13-3.6 5.98-4 2.14-.3 3.67-1.27 4.32-2.73.65-1.47.34-3.26-.87-5.05-.33-.49-.2-1.15.28-1.48.5-.33 1.15-.2 1.5.28 1.6 2.39 2 4.98 1.04 7.11-.94 2.14-3.12 3.6-5.98 4-2.13.3-3.67 1.27-4.32 2.73-.65 1.47-.34 3.26.87 5.05.33.49.21 1.15-.28 1.49-.04.01-.07.04-.1.06zm60-35.91.75 1.71-9.97 4.34-.74-1.72zM87.35 9.7l-.66 1.75L59.14 1.12l.65-1.76zM41.4-6.21l1.62.93L34.2 10l-1.62-.94zM87.35 109.7l-.66 1.76-27.55-10.35.65-1.75zM50.58 56.03l1.85-.3 1.83 11.32-1.85.3zm-6.22 13.79-.5 1.8-17-4.66.5-1.8zM41.4 93.79l1.62.93L34.2 110l-1.62-.94zM87.35 9.7l-.66 1.75L59.14 1.12l.65-1.76zm-7.77 42.56.77 1.76-16.34 7.11-.77-1.75zM1 9.76l.75 1.71-9.96 4.34-.75-1.72zm100 0 .75 1.71-9.97 4.34-.74-1.72zM31.04 27.68l.6 1.86-23.13 7.48-.6-1.86zm48.1 46.45.73-1.72 10 4.28-.74 1.72zM41.4-6.2l1.62.93L34.2 10l-1.62-.94zm26.14 17.4 1.62.94-7.26 12.57-1.62-.94zM21.22 90.35l-.6-1.4 9.58-4.16.6 1.39zm69.3-49.79-1.5 1.12L78.5 27.55l1.5-1.12zm-3.17 69.14-.66 1.76-27.55-10.35.65-1.75zM41.4 93.8l1.62.93L34.2 110l-1.62-.94zM1 9.76l.74 1.71-9.96 4.34-.75-1.72z"/>
            </pattern>
            <pattern id="YMCC" width="260" height="180" patternTransform="rotate(45)"
                     patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#136600"/>
                <path fill="#e8e8e8"
                      d="M51.1 0a220 220 0 0 1 13.85 5.83c21.66 10 42.67 18.46 65 18.48 22.3.02 43.33-8.41 64.99-18.41 4.66-2.16 9.33-4.12 14-5.9h-3.63c-3.45 1.4-6.91 2.89-10.37 4.48-21.66 10-42.69 18.44-65 18.42-22.32-.03-43.33-8.49-65-18.48-3.4-1.57-6.81-3.05-10.22-4.42zm9.18 0c1.55.68 3.1 1.36 4.67 2.08 21.66 10 42.67 18.45 65 18.48 22.3.02 43.33-8.42 64.99-18.42 1.6-.74 3.2-1.44 4.8-2.14h-22.32c-15.64 6.3-31.21 10.79-47.48 10.77C113.73 10.75 98.2 6.27 82.62 0zM0 6.9v.12V7v10.2-.03.12c21.63 0 43.3 6.15 64.95 16.14 21.66 9.99 42.68 18.45 65 18.45 22.31 0 43.33-8.43 64.99-18.43S238.32 17.29 260 17.29V6.9c-21.68 0-43.4 6.15-65.06 16.15s-42.68 18.44-65 18.44c-22.31 0-43.33-8.47-65-18.46C43.3 13.04 21.65 6.89 0 6.89Zm0 25.23V34c21.63 0 43.3 6.15 64.95 16.14 21.66 9.99 42.67 18.46 65 18.47 22.31.01 43.33-8.43 64.99-18.43S238.32 34.02 260 34v-1.87c-21.68 0-43.4 6.18-65.06 16.18s-42.69 18.42-65 18.41c-22.32 0-43.33-8.46-65-18.45C43.3 38.28 21.65 32.13 0 32.13m0 34.06v.07-.02 7.87c21.63 0 43.3 6.15 64.95 16.14 21.66 9.99 42.68 18.44 65 18.45 22.3.01 43.33-8.41 64.99-18.41S238.32 74.11 260 74.11v-7.92c-21.68 0-43.4 6.18-65.06 16.18s-42.69 18.42-65 18.41c-22.32 0-43.33-8.46-65-18.45C43.3 72.34 21.65 66.19 0 66.19m0 47.08v2.79c21.63 0 43.3 6.16 64.95 16.14 21.66 10 42.68 18.45 65 18.46 22.3.01 43.33-8.41 64.99-18.41s43.38-16.19 65.06-16.19v-2.79c-21.68 0-43.4 6.18-65.06 16.19-21.66 10-42.68 18.42-65 18.41-22.31-.01-43.33-8.46-65-18.46-21.64-9.98-43.3-16.14-64.94-16.14m0 27.05v.92c21.63 0 43.3 6.15 64.95 16.14 21.66 9.99 42.67 18.46 65 18.47 22.31.02 43.33-8.43 64.99-18.43s43.38-16.16 65.06-16.18v-.92c-21.68.02-43.4 6.2-65.06 16.2s-42.68 18.43-65 18.41-43.33-8.48-65-18.48C43.3 146.47 21.64 140.32 0 140.32m0 15.83v.05-.01 9.7-.01.06c20.08 0 40.2 5.3 60.3 14.06h22.32a391 391 0 0 1-17.67-7.7C43.3 162.3 21.63 156.14 0 156.14Zm260 0c-21.68.02-43.4 6.2-65.06 16.2-5.87 2.72-11.7 5.3-17.52 7.65h22.31c20.07-8.73 40.19-14.04 60.27-14.06v-9.75zM0 168.28v1.41c17.01 0 34.05 3.82 51.09 10.31h3.6C36.47 172.66 18.23 168.28 0 168.28m260 0c-18.22.02-36.46 4.4-54.67 11.72h3.62c17-6.47 34.04-10.29 51.05-10.3v-1.41z"/>
                <path fill="#f44034"
                      d="M87.35 0c14 5.29 28.02 8.92 42.6 8.92 14.6.01 28.66-3.62 42.7-8.92h-9.38c-10.94 3.46-21.97 5.65-33.33 5.64-11.3-.01-22.28-2.2-33.17-5.64zM0 18.16v.92c21.63 0 43.3 6.15 64.95 16.14 21.66 10 42.68 18.45 65 18.45 22.31 0 43.33-8.43 64.99-18.43s43.37-16.16 65.05-16.16l.01-.01v-.9l-.01-.01c-21.68 0-43.4 6.16-65.05 16.16-21.66 10-42.68 18.43-65 18.43-22.31 0-43.33-8.46-65-18.45C43.3 24.3 21.65 18.16 0 18.16M0 36.8v.06-.02 4.62c21.63 0 43.3 6.16 64.95 16.14 21.66 10 42.67 18.47 65 18.48 22.31.01 43.33-8.43 64.99-18.44 21.66-10 43.37-16.15 65.05-16.17l.01-.03v-4.59l-.01-.04c-21.68 0-43.4 6.18-65.05 16.18-21.66 10-42.68 18.42-65 18.41-22.31 0-43.33-8.46-65-18.45C43.3 42.95 21.65 36.8 0 36.8m0 14v.05-.01 8.72-.01.08c21.63 0 43.3 6.15 64.95 16.14 21.66 10 42.67 18.47 65 18.48 22.31 0 43.33-8.43 64.99-18.44 21.66-10 43.37-16.16 65.05-16.18l.01-.07v-8.72l-.01-.05c-21.68 0-43.4 6.16-65.05 16.16-21.66 10-42.68 18.44-65 18.44-22.31 0-43.33-8.47-65-18.46C43.3 56.95 21.65 50.8 0 50.8m0 26.56v1.4c21.63 0 43.3 6.16 64.95 16.14 21.66 10 42.68 18.45 65 18.46 22.3.01 43.33-8.41 64.99-18.42 21.66-10 43.37-16.18 65.05-16.18h.01v-1.37l-.01-.02c-21.68 0-43.4 6.18-65.05 16.18-21.66 10-42.68 18.42-65 18.41-22.31 0-43.33-8.46-65-18.45C43.3 83.52 21.65 77.37 0 77.37Zm0 41.03v.07-.02 11.09-.01.05c21.63 0 43.3 6.16 64.95 16.14 21.66 10 42.67 18.46 65 18.48 22.3.02 43.33-8.41 64.99-18.41s43.37-16.18 65.05-16.2l.01-.05v-11.09l-.01-.05c-21.68 0-43.4 6.18-65.05 16.18-21.66 10-42.68 18.43-65 18.42-22.31-.01-43.33-8.47-65-18.46C43.3 124.55 21.65 118.4 0 118.4Zm0 32.62v3.29c21.63 0 43.3 6.15 64.95 16.14a345 345 0 0 0 22.4 9.55h9.42c-10.6-3.36-21.13-7.9-31.82-12.84C43.3 157.18 21.63 151.02 0 151.02Zm259.99 0c-21.68.02-43.4 6.2-65.05 16.2-10.63 4.92-21.11 9.44-31.67 12.78h9.38a341 341 0 0 0 22.29-9.51c21.66-10 43.37-16.16 65.05-16.18l.01-.02v-3.25z"/>
                <path fill="#e8e8e8"
                      d="M15.14 0c16.6 2.1 33.2 7.49 49.8 15.15 21.67 9.99 42.68 18.45 65 18.47 22.32.03 43.34-8.4 65-18.4 16.64-7.7 33.32-13.1 49.99-15.22h-20.5a197 197 0 0 0-29.49 11.03c-21.66 10-42.68 18.43-65 18.41s-43.33-8.48-65-18.48A196.6 196.6 0 0 0 35.63 0Zm105.43 0c3.1.32 6.22.5 9.37.51 3.2 0 6.38-.19 9.53-.51zM0 5.11V6.5v-.01.02c21.63 0 43.3 6.15 64.95 16.13 21.66 10 42.68 18.46 65 18.46 22.31 0 43.33-8.43 64.99-18.43s43.37-16.16 65.05-16.16l.01-.02V5.11c-21.7 0-43.4 6.16-65.06 16.16s-42.68 18.44-65 18.44c-22.31 0-43.33-8.47-65-18.46C43.3 11.26 21.65 5.1 0 5.1Zm0 16.78v.08-.03 5.01-.03.08c21.63 0 43.3 6.15 64.95 16.14 21.66 10 42.68 18.44 65 18.46 22.3 0 43.33-8.42 64.99-18.42S238.31 27 259.99 27l.01-.06V21.9c-21.7 0-43.4 6.16-65.06 16.16s-42.68 18.44-65 18.44c-22.31 0-43.33-8.47-65-18.46C43.3 28.04 21.65 21.9 0 21.9Zm0 64.34v6.05c21.63 0 43.3 6.16 64.95 16.14 21.66 10 42.68 18.45 65 18.46 22.3.01 43.33-8.41 64.99-18.41s43.37-16.19 65.05-16.19l.01-.02v-6l-.01-.03c-21.68.02-43.4 6.18-65.05 16.18-21.66 10-42.68 18.45-65 18.44s-43.33-8.49-65-18.48C43.3 92.38 21.65 86.23 0 86.23m0 55.93v3.73c21.63 0 43.3 6.16 64.95 16.14 18.6 8.59 36.73 16.02 55.62 17.97h18.92c18.82-1.94 36.9-9.34 55.45-17.9 21.66-10 43.37-16.18 65.05-16.2l.01-.02v-3.72c-21.7.02-43.4 6.2-65.06 16.2s-42.68 18.44-65 18.42c-22.32-.03-43.33-8.49-65-18.48-21.64-10-43.29-16.14-64.94-16.14m0 32.66v.03-.01V179c5.06 0 10.12.35 15.18.99H35.6c-11.88-3.32-23.74-5.18-35.6-5.18Zm260 0c-11.85.02-23.7 1.88-35.54 5.18h20.46c5.03-.64 10.05-.99 15.07-1h.01v-4.16z"/>
                <path fill="#e8e8e8"
                      d="M40.43 0a203.5 203.5 0 0 1 24.52 9.55c21.66 9.99 42.67 18.45 65 18.47 22.3.03 43.33-8.4 64.99-18.4 8.22-3.8 16.45-7.05 24.69-9.62h-4.28a210 210 0 0 0-20.41 8.22c-21.66 10-42.68 18.43-65 18.41s-43.33-8.48-65-18.48A210 210 0 0 0 44.7 0Zm61 0c9.36 2.63 18.81 4.24 28.51 4.25 9.76 0 19.27-1.6 28.69-4.25h-1.8c-8.83 2.35-17.75 3.78-26.89 3.77-9.1 0-17.98-1.43-26.78-3.77zM0 0v1.03c21.64 0 43.3 6.16 64.95 16.14 21.66 10 42.68 18.46 65 18.46s43.34-8.44 65-18.44c21.65-10 43.36-16.15 65.04-16.15h.01V0c-21.7 0-43.4 6.15-65.06 16.15-21.65 10-42.68 18.44-65 18.44-22.31 0-43.33-8.47-65-18.46C43.3 6.15 21.65 0 0 0m0 2.77v1.39c21.63 0 43.3 6.16 64.95 16.14 21.66 10 42.68 18.46 65 18.46 22.31 0 43.34-8.43 65-18.43 21.65-10 43.36-16.16 65.04-16.16l.01-.01V2.78c-21.7 0-43.4 6.15-65.06 16.15-21.65 10-42.68 18.44-65 18.44-22.31 0-43.33-8.47-65-18.46C43.3 8.92 21.65 2.77.02 2.77Zm0 32.64v.49c21.63 0 43.3 6.15 64.95 16.13 21.66 10 42.68 18.46 65 18.46 22.31 0 43.33-8.43 64.99-18.43s43.37-16.16 65.05-16.16l.01-.01v-.46h-.01c-21.68 0-43.4 6.15-65.05 16.15-21.66 10-42.68 18.44-65 18.44-22.31 0-43.33-8.47-65-18.46C43.3 41.56 21.65 35.41 0 35.41m0 10.73v1.37c21.63 0 43.3 6.16 64.95 16.14 21.66 10 42.67 18.47 65 18.48 22.31.01 43.33-8.43 64.99-18.43s43.37-16.16 65.05-16.18l.01-.01v-1.37c-21.69 0-43.4 6.16-65.06 16.16s-42.68 18.44-65 18.44c-22.31 0-43.33-8.46-65-18.46C43.3 52.3 21.65 46.14 0 46.14M0 60.6v2.79c21.64 0 43.3 6.15 64.95 16.13 21.66 10 42.68 18.45 65 18.46 22.3.01 43.34-8.41 65-18.41 21.65-10 43.36-16.18 65.04-16.18l.01-.02V60.6c-21.68 0-43.4 6.18-65.06 16.18s-42.68 18.42-65 18.41c-22.31 0-43.33-8.46-65-18.46C43.3 66.74 21.65 60.6 0 60.6m0 37.68v.08-.02 11.08-.02.08c21.63 0 43.3 6.16 64.95 16.14 21.66 10 42.68 18.45 65 18.46 22.3.01 43.33-8.41 64.99-18.41s43.37-16.19 65.05-16.19l.01-.06V98.27c-21.7.02-43.4 6.18-65.06 16.18s-42.68 18.45-65 18.44-43.33-8.48-65-18.48C43.3 104.42 21.65 98.27 0 98.27Zm0 35.05v4.18c21.63 0 43.3 6.15 64.95 16.14 21.66 10 42.67 18.46 65 18.48 22.3.02 43.33-8.41 64.99-18.41s43.37-16.19 65.05-16.2l.01-.02v-4.17c-21.7.02-43.4 6.18-65.06 16.18-21.65 10-42.68 18.45-65 18.44-22.32-.02-43.33-8.49-65-18.48-21.64-9.99-43.3-16.14-64.94-16.14m260 15.86h-.01c-21.68 0-43.4 6.18-65.05 16.18-12.79 5.9-25.36 11.25-38.1 14.64h1.79c12.13-3.4 24.12-8.54 36.31-14.17 21.66-10 43.37-16.18 65.05-16.2h.01zm-260 0v.45c21.63 0 43.3 6.15 64.95 16.14 12.25 5.65 24.29 10.8 36.48 14.23h1.72c-12.78-3.4-25.38-8.77-38.2-14.68-21.65-10-43.32-16.15-64.95-16.15Zm260 22.82c-14.88.02-29.77 2.93-44.64 7.99h4.3c13.44-4.2 26.9-6.58 40.34-6.6h.01v-1.38zm-260 0v1.39c13.47 0 26.94 2.4 40.42 6.6h4.27c-14.9-5.07-29.8-7.99-44.69-7.99"/>
            </pattern>
            <pattern id="REDS" width="40" height="20" patternTransform="scale(0.5)" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#ad0000"/>
                <path fill="none" stroke="#000" strokeWidth={2} troke-linecap="square" d="m-10 5 20 10L30 5l20 10"/>
            </pattern>
            <pattern id="RDHC" width="40" height="20" patternTransform="scale(0.5)" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#000"/>
                <path fill="none" stroke="#ad0000" strokeWidth={2} troke-linecap="square" d="m-10 5 20 10L30 5l20 10"/>
            </pattern>

            <pattern id="HAL" width="50" height="33.333" patternTransform="scale(0.5)"
                     patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#7cbbda"/>
                <path fill="#fff"
                      d="M25 .806v2.79h.8V.806Zm0 4.465v2.791h.8v-2.79Zm-2.043 3.902-2.32 1.55.444.665 2.32-1.55zm4.885 0-.444.665 2.32 1.55.445-.665zM-.4 10.61v2.79h.8v-2.79zm50 0v2.79h.8v-2.79zm-30.356 1.042-2.32 1.55.443.666 2.322-1.55-.444-.666zm12.311 0-.444.665 2.32 1.55.445-.664zm3.783 2.566-.444.666 2.321 1.55.444-.666zm-19.852.025-2.32 1.55.444.665 2.32-1.55zm-15.886.77v2.79h.8v-2.79Zm50 0v2.79h.8v-2.79Zm-50 4.465v2.79h.8v-2.79zm50 0v2.79h.8v-2.79zM2.442 23.379l-.444.665 2.32 1.55.445-.665zm45.115 0-2.32 1.55.443.666 2.322-1.55zM6.155 25.86l-.444.665 2.32 1.55.445-.665zm37.69 0-2.322 1.55.444.665 2.321-1.55-.444-.666zM9.937 28.424l-.444.665 2.32 1.55.445-.665zm30.11.003-2.321 1.55.444.666 2.321-1.55zM25 29.737v2.79h.8v-2.79z"/>
            </pattern>

            <pattern id="WHIT" width="69.3" height="46.8" patternTransform="scale(0.25)"
                     patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#0f1743"/>
                <path fill="#fafafa"
                      d="m46.08-12.52-5.68 9.8H12.6L7.77 0-4.1 20.63H-22v5.5h17.9L7.77 46.8l4.83 2.72h27.8l5.68 9.8 14.41.05 7.24-12.52-7.24-12.52-13.19-.05h-1.22l-5.68 9.8H12.6L.68 23.4 12.6 2.72h27.8l5.68 9.8h1.15l.06.1 13.2-.05L67.73.05 60.5-12.47ZM77.03.05 65.16 20.68H47.3v-.06h-5.9L34.14 7.97h-6.4l8.9 15.43-8.9 14.87h6.4l7.25-12.15h5.87v.06h17.9l11.87 20.67 4.83-2.72-11.92-20.68L81.86 2.77Z"/>
            </pattern>
            <pattern id="VPX" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="scale(0.5)">
                <rect width="100%" height="100%" fill="#2b2b31"/>
                <path fill="#c35118"
                      d="m0 0 10 20L20 0zm10 20 10 20 10-20zM20 0l10 20L40 0zm10 20 10 20 10-20zm-40 0L0 40l10-20z"/>
            </pattern>
            <pattern id="CUHC" width="40" height="20" patternTransform="scale(0.5)" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#e67a0f"/>
                <path fill="none" stroke="#fff" strokeWidth="1.5"
                      d="M40 0 20-10V0l20 10zm0 10L20 0v10l20 10zm0 10L20 10v10l20 10zM0 20l20-10v10L0 30zm0-10L20 0v10L0 20zM0 0l20-10V0L0 10z"/>
            </pattern>

            <pattern id="OGMHC" width="97.5" height="49.15" patternTransform="scale(0.5)"
                     patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#000057"/>
                <path fill="#fff"
                      d="M2.6 0 0 1.42v1.73l2.6-1.4 9.25 5.05-10 5.45v6.85l10.05 5.5-10.05 6.2v11.95l4.6 2.5L2.6 47.4 0 45.95v1.76l2.6 1.44 5.4-3 5.45 3 10.85-5.9 10.85 5.9 5.4-2.95 5.4 2.95 10.85-5.9 10.76 5.85h.18l5.31-2.9 5.4 2.95 10.85-5.9 8.2 4.46v-1.76l-7.5-4.1V30.9l7.5-4.12V25.1l-8.25 4.5L80 24.55l9.25-5.05L97.5 24v-1.78L90 18.1V7.25l7.5-4.1V1.41L89.25 5.9 78.4 0 73 2.95 67.6 0 56.75 5.9 45.9 0l-5.4 2.95L35.1 0 24.25 5.9 13.45 0 8 2.95Zm10.85 1.75 10.05 5.5V18.2l-9.3 5.1V6.35l-4.6-2.5Zm21.65 0 10.1 5.5V18.2l-10.05 5.5-10.05-5.5V7.25h-.05zm10.85 0L56 7.25V18.2l-10.45 5.7-11.25 6.15V47L25 41.9V30.95l10.45-5.7L46.7 19.1V6.35l-4.6-2.5Zm21.6 0 3.85 2.1-4.6 2.5V23.3l-9.3-5.1V7.25Zm10.85 0 10.05 5.5V18.2L76.8 24.6 88.45 31v10.95l-10.05 5.5-3.85-2.1 4.6-2.5V30.9L69.1 24.7l10.05-5.5v-6.95l-10-5.45zM24.25 19.5l9.25 5.05-9.25 5.05L15 24.55Zm32.5 0L66 24.55l-9.25 5.05-9.25-5.05ZM0 22.22V24l1 .55-1 .54v1.69l4.2-2.23zm13.5 3.23 10.05 5.5V41.9h-.05l-10.05 5.5L3.4 41.9V31.7zm32.45 0L56 30.95V41.9l-10.05 5.5-3.85-2.1 4.6-2.5v-6.85l-10-5.45Zm21.65 0 10.1 6.25v10.2l-10.1 5.5-10.05-5.5V30.95z"/>
                <path fill="#f44034"
                      d="M35.1 7.2 30.3 10v5.55l4.8 2.8 4.8-2.8V10ZM13.45 29.1l-6.3 3.65v7.3l6.3 3.65 6.3-3.65v-7.3Zm54.15 0-6.3 3.65v7.3l6.3 3.65 6.3-3.65v-7.3Zm-54.15 1.75 4.8 2.8v5.55l-4.8 2.8-4.8-2.8v-5.55zm54.15 0 4.8 2.8v5.55L67.6 42l-4.8-2.8v-5.55z"/>
                <path fill="#00bdd6"
                      d="m18.45 0 5.9 3.25L30.3 0ZM50.9 0l5.95 3.25L62.75 0Zm32.45 0 5.9 3.25L95.2 0Zm-59 21.35-5.9 3.2 5.9 3.25 5.95-3.25zm32.5 0-5.95 3.2 5.95 3.25 5.9-3.25zm32.4 0-5.9 3.2 5.9 3.25 5.95-3.25zM24.35 45.9l-5.9 3.25H30.3zm32.5 0-5.95 3.25h11.85Zm32.4 0-5.9 3.25H95.2Z"/>
            </pattern>

            <pattern id="NCR" width="40" height="40" patternTransform="scale(0.5)" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%"/>
                <path fill="#4bec53" d="M20 20v20h20V20zm10 5 5 5-5 5-5-5zM0 0v20h20V0zm10 5 5 5-5 5-5-5z"/>
                <path fill="#f4d734" d="m10 25 5 5-5 5-5-5zM30 5l5 5-5 5-5-5z"/>
            </pattern>


            <pattern id="MOGM" width="60" height="30" patternTransform="scale(0.5)" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#2b2b31"/>
                <path fill="#ecc94b" d="M1-6.5v13h28v-13zm15 15v13h28v-13zm-15 15v13h28v-13z"/>
                <path fill="#560116"
                      d="M31-6.5v13h28v-13zm-45 15v13h28v-13zm60 0v13h28v-13zm-15 15v13h28v-13z"/>
            </pattern>

            <pattern id="SUBS" width="50" height="50" patternTransform="scale(0.5)" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#ecc94b"/>
                <path fill="#23234d"
                      d="M9.32 0 0 9.32v9.31L18.63 0zm22.05 0 9.31 9.32L50 18.63V9.32L40.68 0zM25 6.37 6.37 25 25 43.63 43.63 25zm-25 25v9.31L9.32 50h9.31zm50 0L31.37 50h9.31L50 40.68z"/>
                <path fill="#f44034"
                      d="M18.63 0 25 6.37 31.37 0zM0 18.63v12.74L6.37 25zm50 0L43.63 25 50 31.37zm-25 25L18.63 50h12.74z"/>
            </pattern>
            <pattern id="NKHC" width="80" height="20" patternTransform="scale(0.25)" patternUnits="userSpaceOnUse">
                <rect width="100%" height="100%" fill="#00008a"/>
                <path fill="none" stroke="#b38c00" strokeWidth="5.5"
                      d="M-20.133 4.568C-13.178 4.932-6.452 7.376 0 10s13.036 5.072 20 5c6.967-.072 13.56-2.341 20-5s13.033-4.928 20-5c6.964-.072 13.548 2.376 20 5s13.178 5.068 20.133 5.432"/>
            </pattern>
        </defs>
    </svg>
</>

function colorClub(code: string, index: number) {
    const CODED_CLUBS = [
        'FCHC',
        'MEL',
        'UWA',
        'WASPS',
        'WOL',
        'YMCC',
        'REDS',
        'HAL',
        'WHIT',
        'VPX',
        'CUHC',
        'OGMHC',
        'NCR',
        'MOGM',
        'SUBS',
        'NKHC',
        'RDHC'
    ]
    if (CODED_CLUBS.includes(code)) {
        return `url(#${code})`
    }
    return COLORS[index % COLORS.length]
}

export function colorFromCardType(color: string) {
    if (color.includes('G')) {
        return '#187200'
    } else if (color.includes('10')) {
        return '#843e00'
    } else if (color.includes('Y')) {
        return '#e7a807'
    } else {
        return '#dd1f06'
    }
}

export function UmpireGraphs({
                                 fromYear,
                                 toYear,
                                 level,
                                 gender,
                                 umpireData,
                                 pieChart,
                                 setPieChart
                             }: UmpireGraphsParams) {

    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()
    const relevantUmpires = useMemo(() =>
            umpireData.filter(it => it.umpireStats).filter(it =>
                it.umpireStats.competitions.filter(c =>
                    fromYear <= c.year && c.year <= toYear && levelComparer(level, c) && (gender === '-' || c.gender === gender)
                ).length
            ) ?? [],
        [fromYear, gender, level, umpireData, toYear]
    )


    const setSelectedUmpire = useCallback((umpire: string | null) => {
        if (umpire) {
            router.push(pathname + `?tab=umpire&name=${urlFix(umpire)}`)
        } else {
            router.push(pathname + `?tab=umpire`)
        }
    }, [pathname, router])

    const selectedUmpire = useMemo(() => relevantUmpires.find(it => urlFix(it.umpire.name) === searchParams.get('name')) ?? relevantUmpires[0] ?? null, [relevantUmpires, searchParams]);


    const gamesPerVenue = Object.entries(selectedUmpire?.umpireStats.gamesPerVenue ?? {}).map(([k, v], i) =>
        ({name: k, value: v, color: COLORS[i % COLORS.length]})
    ).toSorted((a, b) => a.value - b.value)

    const gamesPerTeam = Object.entries(selectedUmpire?.umpireStats.gamesPerTeam ?? {}).map(([k, v], i) =>
        ({name: k, value: v, color: colorClub(k, i)})
    ).toSorted((a, b) => a.value - b.value)

    const cardsPerTeam = Object.entries(selectedUmpire?.umpireStats.cardsPerTeam ?? {}).map(([k, v], i) =>
        ({name: k, value: Object.values(v).reduce((a, b) => a + b, 0), color: colorClub(k, i)})
    ).toSorted((a, b) => a.value - b.value)

    const cardsPerTeamPerGame = Object.entries(selectedUmpire?.umpireStats.cardsPerTeam ?? {}).map(([k, v], i) =>
        ({
            name: k,
            value: Math.round(100 * Object.values(v).reduce((a, b) => a + b, 0) / selectedUmpire.umpireStats.gamesPerTeam[k]) / 100,
            color: colorClub(k, i)
        })
    ).toSorted((a, b) => a.value - b.value)

    const gamesPerUmpire = Object.entries(selectedUmpire?.umpireStats.gamesWithUmpires ?? {}).map(([k, v], i) =>
        ({name: k, value: v, color: COLORS[i % COLORS.length]})
    ).toSorted((a, b) => a.value - b.value)

    const gamesPerWeek = Object.entries(selectedUmpire?.umpireStats.compsEveryWeek ?? {}).map(([k, v]) =>
        Object.assign({week: new Date(+k).toLocaleDateString()}, ...Object.entries(v).map(([k, v]) => ({[k]: v})))
    )

    const cardsPerWeek = Object.entries(selectedUmpire?.umpireStats.cardsEveryWeek ?? {}).map(([k, v]) =>
        Object.assign({week: new Date(+k).toLocaleDateString()}, ...Object.entries(v).map(([k, v]) => ({[k]: v})))
    )

    const cardsPerGamePerWeek = Object.entries(selectedUmpire?.umpireStats.cardsPerGameEveryWeek ?? {}).map(([k, v]) =>
        Object.assign({week: new Date(+k).toLocaleDateString()}, ...Object.entries(v).map(([k2, v]) => ({[k2]: v})))
    )

    console.log(cardsPerGamePerWeek)

    return <>
        <Group ta="center" w="100%" align="center" justify="center" pt={15}>
            <Title order={3} ta="center">Umpire: </Title>
            <Select w={200}
                    searchable
                    data={relevantUmpires.map(it => it.umpire.name)}
                    value={selectedUmpire?.umpire.name ?? '-'}
                    onChange={it => setSelectedUmpire(it)}/>
        </Group>

        <Grid w="100%" gap={3} p={20}>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Stats</Title>
                <Table>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>
                                Statistic
                            </Table.Th>
                            <Table.Th>
                                Value
                            </Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        <Table.Tr>
                            <Table.Th>
                                Games Umpired
                            </Table.Th>
                            <Table.Td>
                                {selectedUmpire?.umpireStats?.games}
                            </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                            <Table.Th>
                                Average Games Umpired per Week
                            </Table.Th>
                            <Table.Td>
                                {selectedUmpire?.umpireStats?.averageGamesPerWeek}
                            </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                            <Table.Th>
                                Average Games Umpired per Year
                            </Table.Th>
                            <Table.Td>
                                {Math.round(100 * (selectedUmpire?.umpireStats?.games ?? 0) / (selectedUmpire?.umpireStats?.years?.length ?? 1)) / 100}
                            </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                            <Table.Th>
                                First year Umpiring
                            </Table.Th>
                            <Table.Td>
                                {Math.min(...(selectedUmpire?.umpireStats?.years ?? [0]))}
                            </Table.Td>
                        </Table.Tr>
                        <Table.Tr>
                            <Table.Th>
                                Years Umpired
                            </Table.Th>
                            <Table.Td>
                                {selectedUmpire?.umpireStats?.years.length}
                            </Table.Td>
                        </Table.Tr>
                    </Table.Tbody>
                </Table>
            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games Per Venue</Title>
                <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {pieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {pieChart ?
                    <PieChart data={gamesPerVenue} withTooltip tooltipDataSource="segment"
                              mx="auto"
                              size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}{teamDefs}</PieChart> :
                    <BarChart data={gamesPerVenue}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Games Umpired', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: gamesPerVenue.map(it => it.value).reduce((a, b) => a + b, 0) / gamesPerVenue.length,
                                      color: 'dimmed',
                                      label: 'Average',
                                      labelPosition: 'insideTopLeft',
                                  },
                              ]}>{defs}{teamDefs}
                    </BarChart>
                }
            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games Per Team</Title>
                <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {pieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {pieChart ?
                    <PieChart data={gamesPerTeam} withTooltip tooltipDataSource="segment"
                              mx="auto"
                              size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={gamesPerTeam}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Games Umpired', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: gamesPerTeam.map(it => it.value).reduce((a, b) => a + b, 0) / gamesPerTeam.length,
                                      color: 'dimmed',
                                      label: 'Average',
                                      labelPosition: 'insideTopLeft',
                                  },
                              ]}>{defs}</BarChart>
                }
            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games With Co-Umpires</Title>
                <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {pieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {pieChart ?
                    <PieChart data={gamesPerUmpire} withTooltip tooltipDataSource="segment"
                              mx="auto"
                              size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={gamesPerUmpire}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Games Umpired', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: gamesPerUmpire.map(it => it.value).reduce((a, b) => a + b, 0) / gamesPerUmpire.length,
                                      color: 'dimmed',
                                      label: 'Average',
                                      labelPosition: 'insideTopLeft',
                                  },
                              ]}>{defs}</BarChart>
                }
            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Games Per Week</Title>


                <BarChart data={gamesPerWeek}
                          withTooltip
                          mx="auto"
                          type="stacked"
                          series={(selectedUmpire?.umpireStats?.competitions ?? []).map((it, i) => ({
                              name: it.name,
                              color: COLORS[i % COLORS.length]
                          }))}
                          dataKey="week"
                          h={300}
                          referenceLines={[
                              {
                                  y: gamesPerWeek.map(it => it.value).reduce((a, b) => a + b, 0) / gamesPerWeek.length,
                                  color: 'dimmed',
                                  label: 'Average',
                                  labelPosition: 'insideTopLeft',
                              },
                          ]}>{defs}</BarChart>

            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Cards Per Week</Title>


                <BarChart data={cardsPerWeek}
                          withTooltip
                          mx="auto"
                          type="stacked"
                          series={Object.keys(selectedUmpire?.umpireStats?.cards ?? {}).map((it) => ({
                              name: it,
                              color: colorFromCardType(it)
                          }))}
                          dataKey="week"
                          h={300}
                          referenceLines={[
                              {
                                  y: cardsPerWeek.map(it => it.value).reduce((a, b) => a + b, 0) / cardsPerWeek.length,
                                  color: 'dimmed',
                                  label: 'Average',
                                  labelPosition: 'insideTopLeft',
                              },
                          ]}>{defs}</BarChart>

            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Cards Per Game Per Week</Title>

                <BarChart data={cardsPerGamePerWeek}
                          withTooltip
                          mx="auto"
                          series={Object.keys(selectedUmpire?.umpireStats?.cards ?? {}).map((it) => ({
                              name: it,
                              color: colorFromCardType(it)
                          }))}
                          dataKey="week"
                          type="stacked"
                          h={300}
                          referenceLines={[
                              {
                                  y: cardsPerGamePerWeek.map(it => it.value).reduce((a, b) => a + b, 0) / cardsPerGamePerWeek.length,
                                  color: 'dimmed',
                                  label: 'Average',
                                  labelPosition: 'insideTopLeft',
                              },
                          ]}>{defs}
                </BarChart>

            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Cards Per Team</Title>
                <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {pieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {pieChart ?
                    <PieChart data={cardsPerTeam} withTooltip tooltipDataSource="segment"
                              mx="auto"
                              size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={cardsPerTeam}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Cards Given', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: cardsPerTeam.map(it => it.value).reduce((a, b) => a + b, 0) / cardsPerTeam.length,
                                      color: 'dimmed',
                                      label: 'Average',
                                      labelPosition: 'insideTopLeft',
                                  },
                              ]}>{defs}
                    </BarChart>
                }
            </Grid.Col>
            <Grid.Col span={{base: 12, md: 3}} p={10}>
                <Title order={3} ta="center">Cards Per Team Per Game</Title>
                <Text onClick={() => setPieChart(!pieChart)} my={5} ta="center" c="dimmed" fs="italic"
                      style={{textDecoration: 'underline'}}>
                    View as {pieChart ? 'Bar' : 'Pie'} Chart
                </Text>

                {pieChart ?
                    <PieChart data={cardsPerTeamPerGame} withTooltip tooltipDataSource="segment"
                              mx="auto"
                              size={250}
                              startAngle={90} endAngle={360 + 90} strokeWidth={0}>{defs}</PieChart> :
                    <BarChart data={cardsPerTeamPerGame}
                              withTooltip
                              mx="auto"
                              series={[
                                  {label: 'Cards Given', name: 'value'}
                              ]}
                              dataKey="name"
                              h={300}
                              referenceLines={[
                                  {
                                      y: cardsPerTeamPerGame.map(it => it.value).reduce((a, b) => a + b, 0) / cardsPerTeamPerGame.length,
                                      color: 'dimmed',
                                      label: 'Average',
                                      labelPosition: 'insideTopLeft',
                                  },
                              ]}>{defs}
                    </BarChart>
                }
            </Grid.Col>

        </Grid></>
}