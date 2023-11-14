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

const INITIAL_NO_TRANSFORM: () => Document.VisuElement.ElementTransform =
  () => ({
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotate: 0,
  })

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

  selectedVisuUidMap: SelectedVisuMap
  selectedPointsMap: SelectedPointMap
  vectorPenLastPoint: {
    visuUid: string
    pointIdx: number
  } | null

  setVectorPenLastPoint: (
    pointData: {
      visuUid: string
      pointIdx: number
    } | null,
  ) => void

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

  setVisuTransformOverride: (
    updater:
      | ((
          prev: Document.VisuElement.ElementTransform,
        ) => Document.VisuElement.ElementTransform | null)
      | null,
  ) => void

  setPointTransformOverride: (
    updater:
      | ((
          prev: Document.VisuElement.ElementTransform,
        ) => Document.VisuElement.ElementTransform | null)
      | null,
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

    selectedVisuUidMap: {},
    selectedPointsMap: {},
    vectorPenLastPoint: null,
    setVectorPenLastPoint: (pointData) => {
      set(() => ({ vectorPenLastPoint: pointData }))
    },

    visuTransformOverride: null,
    pointTransformOverride: null,

    setEditorState: set,
    getEditorState: get,

    setSelectedVisuUids: (updater) => {
      set((prev) => ({ selectedVisuUidMap: updater(prev.selectedVisuUidMap) }))
    },
    setSelectedPoints: (updater) => {
      set((prev) => ({ selectedPointsMap: updater(prev.selectedPointsMap) }))
    },

    setVisuTransformOverride: (updater) => {
      set((prev) => ({
        visuTransformOverride:
          updater?.(prev.visuTransformOverride ?? INITIAL_NO_TRANSFORM()) ??
          null,
      }))
    },
    setPointTransformOverride: (updater) => {
      set((prev) => ({
        pointTransformOverride:
          updater?.(prev.pointTransformOverride ?? INITIAL_NO_TRANSFORM()) ??
          null,
      }))
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
