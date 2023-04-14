import { Paplico } from '@paplico/core-new'
import { createContext, useContext, useRef, useSyncExternalStore } from 'react'
import { useEffectOnce } from 'react-use'

const PapReactContext = createContext<Paplico | null>(null)

export const PaplicoProvider = PapReactContext.Provider

export function usePaplicoState(pap: Paplico | undefined | null) {
  const engine = useContext(PapReactContext)

  useSyncExternalStore(
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
