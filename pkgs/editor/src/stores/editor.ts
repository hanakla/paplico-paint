import { type RectReadOnly } from 'react-use-measure'
import { createStore, type StoreApi } from 'zustand'
import { useContext, useMemo } from 'react'
import { StoresContext } from './context'
import { EditorTypes, RasterToolModes, VectorToolModes } from '@/stores/types'
import { BoundedUseStore, createUseStore } from '@/utils/zustand'
import Paplico, { Document } from '@paplico/core-new'

export type EditorStore = {
  _rootBBox: RectReadOnly

  draggingThreadholdRealPixels: number

  strokingTarget: Paplico.StrokingTarget | null
  // strokeTargetVisu: Document.VisuElement.AnyElement | null

  enabled: boolean
  editorType: EditorTypes
  rasterToolMode: RasterToolModes
  vectorToolMode: VectorToolModes
  canvasScale: number
  brushSizePreview: { size: number; durationMs: number } | null
  selectedVisuUids: Record<string, true>

  setEditorState: StoreApi<EditorStore>['setState']
  getEditorState: StoreApi<EditorStore>['getState']
  setSelectedVisuUids: (
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

    draggingThreadholdRealPixels: 0,

    strokingTarget: null,

    enabled: false,
    editorType: EditorTypes.none,
    rasterToolMode: RasterToolModes.stroking,
    vectorToolMode: VectorToolModes.rectangleTool,

    canvasScale: 1,
    brushSizePreview: null,
    selectedVisuUids: {},

    setEditorState: set,
    getEditorState: get,
    setSelectedVisuUids: (updater) => {
      set((prev) => ({ selectedVisuUids: updater(prev.selectedVisuUids) }))
    },
  }))
}

export const useEditorStore: BoundedUseStore<StoreApi<EditorStore>> = <U>(
  selector?: (S: EditorStore) => U,
) => {
  const { editor } = useContext(StoresContext)!
  const useStore = useMemo(() => createUseStore(editor), [editor])

  return useStore(selector)
}

export const layerTypeToEditorType = (
  layerType: Document.VisuElement.AnyElement['type'] | undefined,
): EditorStore['editorType'] => {
  // prettier-ignore
  return (
    layerType ==='canvas' ? 'raster' :
    layerType ==='vectorObject' ? 'vector' :
    layerType ==='group' ? 'vector' :
    layerType ==='text' ? 'text' :
    'none'
  )
}

export const isVectorShapeToolMode = (toolMode: VectorToolModes) => {
  return (
    toolMode === VectorToolModes.ellipseTool ||
    toolMode === VectorToolModes.rectangleTool
  )
}
