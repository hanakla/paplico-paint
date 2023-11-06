import { Document, type Paplico } from '@paplico/core-new'
import { type StoreApi, createStore } from 'zustand'
import { useContext, useMemo } from 'react'
import { StoresContext } from './context'
import { BoundedUseStore, createUseStore } from '@/utils/zustand'

export type EngineStore = {
  paplico: Paplico
  state: Omit<Paplico.State, 'busy'>
  busyState: Paplico.State['busy']

  _setPaplicoInstance: (paplico: Paplico) => void
  _setEngineState: (state: Paplico.State) => void
  set: StoreApi<EngineStore>['setState']
}

export const createEngineStore = () => {
  return createStore<EngineStore>((set, get) => ({
    paplico: null!,
    state: null!,
    busyState: true,
    activeVisu: null,

    _setPaplicoInstance: (paplico) => set({ paplico }),
    _setEngineState: (state) => set({ state }),
    set,
  }))
}

export const useEngineStore: BoundedUseStore<StoreApi<EngineStore>> = <U>(
  selector?: (s: EngineStore) => U,
) => {
  const { engine } = useContext(StoresContext)!
  const useStore = useMemo(() => createUseStore(engine), [engine])

  return useStore(selector)
}
