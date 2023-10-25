import { Paplico } from '@paplico/core-new'
import { createContext, useContext } from 'react'
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
  enabled: boolean
  canvasScale: number
  brushSizePreview: { size: number; durationMs: number } | null
  selectedObjectIds: Record<string, true>

  setSelectedObjectIds: (
    updater: (prev: Record<string, true>) => Record<string, true>,
  ) => void
}
export const createEditorStore = () => {
  return createStore<EditorStore>((set, get) => ({
    enabled: false,
    canvasScale: 1,
    brushSizePreview: null,
    selectedObjectIds: {},

    setSelectedObjectIds: (updater) => {
      set((prev) => ({ selectedObjectIds: updater(prev.selectedObjectIds) }))
    },
  }))
}
export const useEditorStore = () => {
  const { editor } = useContext(StoresContext)!
  return useStore(editor)
}
