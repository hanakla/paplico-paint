import {
  type Paplico,
  PplcFilter,
  PplcBrush,
  PplcInk,
  Document,
} from '@paplico/core-new'
import { type StoreApi, createStore } from 'zustand'
import { useContext, useMemo } from 'react'
import { StoresContext } from './context'
import { BoundedUseStore, createUseStore } from '@/utils/zustand'

export type EngineStore = {
  paplico: Paplico
  state: Omit<Paplico.State, 'busy'>
  busyState: Paplico.State['busy']

  currentBrushSetting: Document.VisuFilter.Structs.BrushSetting | null
  currentInkSetting: Document.VisuFilter.Structs.InkSetting | null
  currentFillSetting: Document.VisuFilter.Structs.FillSetting | null

  availableBrushes: PplcBrush.BrushClass[]
  availableInks: PplcInk.InkClass[]
  availableFilters: PplcFilter.FilterClass[]

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

    currentBrushSetting: null,
    currentInkSetting: null,
    currentFillSetting: null,

    availableBrushes: [],
    availableInks: [],
    availableFilters: [],

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
