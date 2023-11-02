import { type RectReadOnly } from 'react-use-measure'
import { createStore, useStore, type StoreApi } from 'zustand'
import { type BoundedUseStore } from './helper'
import { useContext } from 'react'
import { StoresContext } from './context'
import { ToolModes } from '@/utils/types'

export type EditorStore = {
  _rootBBox: RectReadOnly

  enabled: boolean
  currentType: 'raster' | 'vector' | 'text' | 'none'
  toolMode: ToolModes
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
    toolMode: ToolModes.rectangleTool,

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

export const isShapeToolMode = (toolMode: ToolModes) => {
  return (
    toolMode === ToolModes.ellipseTool || toolMode === ToolModes.rectangleTool
  )
}
