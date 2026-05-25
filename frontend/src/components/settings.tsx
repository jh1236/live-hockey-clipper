'use client'

import {createContext, SetStateAction, useContext} from 'react';
import {useLocalStorage} from "react-use";


type SettingsProvided = {
    settings: Settings;
    setSetting: SetSetting;
    getSetting: GetSetting
}
export type Settings = {
    useSimplified: boolean;
    liveHockeyUsername: string | undefined;
    liveHockeyPassword: string | undefined;
}

type GetSetting = <T extends keyof Settings>(key: T) => Settings[T];

type SetSetting = <T extends keyof Settings>(key: T, value: SetStateAction<Settings[T]>) => void;

const defaultSettings: Settings = {
    useSimplified: true,
    liveHockeyPassword: undefined,
    liveHockeyUsername: undefined
}

const SettingsContext = createContext<SettingsProvided>({
    getSetting: (key) => defaultSettings[key],
    setSetting: () => {
        throw new Error('Cannot set unloaded settings')
    },
    settings: defaultSettings
})

export const useSettings = () => useContext(SettingsContext)


export function useSetting<T extends keyof Settings>(key: T): [Settings[T], ((value: (Settings[T] | ((prev: Settings[T]) => Settings[T]))) => void)] {
    const {getSetting, setSetting} = useSettings()
    return [getSetting(key), (value) => setSetting(key, value)]
}

interface SettingsProps {
    children: React.ReactElement;
}

export function SettingsProvider({children}: SettingsProps) {
    const [settings, setSettings] = useLocalStorage<Settings>('settings', defaultSettings)
    const setSetting: SetSetting = (key, value) => {
        let calculatedValue: Settings[typeof key]
        if (typeof value === 'function') {
            calculatedValue = value((settings ?? defaultSettings)[key])
        } else {
            calculatedValue = value
        }
        const newSettings = Object.assign(settings ?? defaultSettings, {key: calculatedValue})
        setSettings(newSettings);
    }
    const getSetting: GetSetting = (key) => (settings ?? defaultSettings)[key];
    return <SettingsContext value={{
        settings: settings ?? defaultSettings,
        setSetting,
        getSetting
    }}>
        {children}
    </SettingsContext>
}
