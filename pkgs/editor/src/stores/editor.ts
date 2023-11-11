import { type RectReadOnly } from 'react-use-measure'
import { createStore, type StoreApi } from 'zustand'
import { useContext, useMemo } from 'react'
import { StoresContext } from './context'
import { EditorTypes, ToolModes as ToolModes } from '@/stores/types'
import { BoundedUseStore, createUseStore } from '@/utils/zustand'
import Paplico, { Document } from '@paplico/core-new'

type SelectedVisuMap = {
  [visuUid: string]: true | undefined
}

type SelectedPointMap = {
  [visuUid: string]:
    | {
        [pointIdx: number]: true | undefined
      }
    | undefined
}

export type DisplayedResolvedNode = Readonly<
  Document.PaplicoDocument.ResolvedLayerNode & {
    uid: string
    visible: boolean
    locked: boolean
  }
>

export type EditorStore = {
  _rootBBox: RectReadOnly

  draggingThreadholdRealPixels: number

  strokingTarget: Paplico.StrokingTarget | null
  // strokeTargetVisu: Document.VisuElement.AnyElement | null

  enabled: boolean
  editorType: EditorTypes
  toolMode: ToolModes
  canvasScale: number
  brushSizePreview: { size: number; durationMs: number } | null

  displayedResolvedNodes: DisplayedResolvedNode[]
  setDisplayResolvedNodes: (nodes: DisplayedResolvedNode[]) => void

  selectedVisuUids: SelectedVisuMap
  selectedPoints: SelectedPointMap

  visuTransformOverride: Document.VisuElement.ElementTransform | null
  pointTransformOverride: Document.VisuElement.ElementTransform | null

  setEditorState: StoreApi<EditorStore>['setState']
  getEditorState: StoreApi<EditorStore>['getState']

  setSelectedVisuUids: (
    updater: (prev: SelectedVisuMap) => SelectedVisuMap,
  ) => void
  setSelectedPoints: (
    updater: (prev: SelectedPointMap) => SelectedPointMap,
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
    toolMode: ToolModes.rectangleTool,

    canvasScale: 1,
    brushSizePreview: null,

    displayedResolvedNodes: [],
    setDisplayResolvedNodes: (nodes) => {
      set(() => ({ displayedResolvedNodes: nodes }))
    },

    selectedVisuUids: {},
    selectedPoints: {},

    visuTransformOverride: null,
    pointTransformOverride: null,

    setEditorState: set,
    getEditorState: get,

    setSelectedVisuUids: (updater) => {
      set((prev) => ({ selectedVisuUids: updater(prev.selectedVisuUids) }))
    },
    setSelectedPoints: (updater) => {
      set((prev) => ({ selectedPoints: updater(prev.selectedPoints) }))
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
    'vector'
  )
}

export const isVectorShapeToolMode = (toolMode: ToolModes) => {
  return (
    toolMode === ToolModes.ellipseTool ||
    toolMode === ToolModes.rectangleTool ||
    toolMode === ToolModes.objectTool
  )
}
