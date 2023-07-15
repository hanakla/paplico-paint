import { Paplico } from '@paplico/core-new'
import { createContext, useContext, useSyncExternalStore } from 'react'

const PapReactContext = createContext<Paplico | null>(null)

export const PaplicoProvider = PapReactContext.Provider

export function usePaplicoState() {
  const engine = useContext(PapReactContext)

  return useSyncExternalStore(
    (callback) => {
      if (engine == null) return () => {}

      engine.on('stateChanged', callback)

      return () => {
        engine.off('stateChanged', callback)
      }
    },
    () => ({
      ...engine?.state,
    })
  )
}
