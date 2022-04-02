import { createContext } from 'react'
import { Silk3 } from 'silk-core'

export const EngineContext = createContext<Silk3 | null>(null)
export const EngineContextProvider = EngineContext.Provider
