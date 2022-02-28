import {createContext} from 'react'
import {Silk} from 'silk-core'

export const EngineContext = createContext<Silk | null>(null)
export const EngineContextProvider = EngineContext.Provider
