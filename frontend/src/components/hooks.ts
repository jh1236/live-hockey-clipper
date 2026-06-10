import {useEffect, useState} from "react";
import {useLocalStorage} from "react-use";


// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export function useStorageBackedValue<T extends {}>(key: string, initial: T) {
    const [state, setState] = useState<T>(initial)
    const [backedState, setBackedState] = useLocalStorage(key, initial)

    useEffect(() => {
        if (backedState === undefined) return;
        setState(backedState)
    }, [backedState])
    
    return {
        value: state,
        savedValue: backedState,
        saveValue: () => setBackedState(state),
        setValue: setState,
        resetValue: () => setState(initial),
        reloadValue: () => setState(backedState ?? initial)
    }
}