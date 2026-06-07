import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';

import {ColorSchemeScript, MantineProvider, mantineHtmlProps} from '@mantine/core';
import {SettingsProvider} from "@/components/settings";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Live Hockey Clipper",
    description: "Clips a game of hockey based on user timestamps",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" {...mantineHtmlProps}>
        <head>
            <ColorSchemeScript/>
            <title>Live Hockey Clipper</title>
        </head>
        <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
        <SettingsProvider>
            <MantineProvider defaultColorScheme="dark">
                {children}
            </MantineProvider>
        </SettingsProvider>
        </body>
        </html>
    );
}
