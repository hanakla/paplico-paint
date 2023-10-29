import { Paplico } from '@paplico/core-new'
import { createContext, useContext, useMemo } from 'react'
import { RectReadOnly } from 'react-use-measure'
import { useStore } from 'zustand'
import { StoreApi, createStore } from 'zustand/vanilla'

export const StoresContext = createContext<{
  engine: StoreApi<EngineStore>
  editor: StoreApi<EditorStore>
} | null>(null)

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
export const useEngineStore = () => {
  const { engine } = useContext(StoresContext)!
  return useStore(engine)
}

export type EditorStore = {
  _rootBBox: RectReadOnly

  enabled: boolean
  currentType: 'raster' | 'vector' | 'none'
  canvasScale: number
  brushSizePreview: { size: number; durationMs: number } | null
  selectedObjectIds: Record<string, true>

  setEditorState: StoreApi<EditorStore>['setState']
  getEditorState: StoreApi<EditorStore>['getState']
  setSelectedObjectIds: (
    updater: (prev: Record<string, true>) => Record<string, true>,
  ) => void
}
export const createEditorStore = () => {
  return createStore<EditorStore>((set, get) => ({
    _rootBBox: {
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      x: 0,
      y: 0,
    },

    enabled: false,
    currentType: 'none',

    canvasScale: 1,
    brushSizePreview: null,
    selectedObjectIds: {},

    setEditorState: set,
    getEditorState: get,
    setSelectedObjectIds: (updater) => {
      set((prev) => ({ selectedObjectIds: updater(prev.selectedObjectIds) }))
    },
  }))
}
export const useEditorStore: BoundedUseStore<StoreApi<EditorStore>> = <
  T extends (s: EditorStore) => unknown,
>(
  selector?: T,
) => {
  const { editor } = useContext(StoresContext)!
  return useStore(editor, selector as any) as any
}

// Zustand patching for optional selector type
type BoundedUseStore<S extends StoreApi<any>> = {
  (): ExtractState<S>
  <U = void>(
    selector?: (state: ExtractState<S>) => U,
  ): U extends void ? ExtractState<S> : U
}

type ExtractState<S> = S extends {
  getState: () => infer T
}
  ? T
  : never
