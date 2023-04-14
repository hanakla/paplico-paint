import { Paplico } from '@paplico/core-new'
import { createContext, useContext } from 'react'

export const PaplicoEngineContext = createContext<Paplico>(null!)
export const PaplicoEngineProvider = PaplicoEngineContext.Provider
export const usePaplicoEngine = () => useContext(PaplicoEngineContext)
