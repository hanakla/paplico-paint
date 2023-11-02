import { type Paplico } from '@paplico/core-new'
import { type StoreApi, createStore, useStore } from 'zustand'
import { type BoundedUseStore } from './helper'
import { type EditorStore } from './editor'
import { useContext } from 'react'
import { StoresContext } from './context'

export type EngineStore = {
  paplico: Paplico
  state: Paplico.State

  _setPaplicoInstance: (paplico: Paplico) => void
  _setEngineState: (state: Paplico.State) => void
}

export const createEngineStore = () => {
  return createStore<EngineStore>((set, get) => ({
    paplico: null!,
    state: null!,

    _setPaplicoInstance: (paplico) => set({ paplico }),
    _setEngineState: (state) => set({ state }),
  }))
}
export const useEngineStore: BoundedUseStore<StoreApi<EngineStore>> = <
  T extends (s: EditorStore) => unknown,
>(
  selector?: T,
) => {
  const { engine } = useContext(StoresContext)!
  return useStore(engine, selector as any) as any
}
