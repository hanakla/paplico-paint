import { createSlice } from '@fleur/lys'
import type { Draft } from 'immer'
import { SliceActionContext } from '@fleur/lys/dist/slice'
import { debounce } from 'debounce'
import { Silk, SilkEntity, SilkValue } from '../../silk-core/src'
import { deepClone } from '../utils/clone'
import { log, trace, warn } from '../utils/log'

interface State {
  engine: Silk | null
  currentTool: Tool
  currentFill: SilkValue.FillSetting | null
  currentStroke: SilkValue.BrushSetting | null
  activeLayerId: string | null
  activeObjectId: string | null
  activeObjectPointIndices: number[]
  selectedFilterIds: { [id: string]: true | undefined }
  vectorStroking: VectorStroking | null
  vectorFocusing: { objectId: string } | null
  clipboard: SilkEntity.VectorObject | null
}

type Tool = 'cursor' | 'shape-pen' | 'draw' | 'erase'
type VectorStroking = {
  objectId: string
  selectedPointIndex: number
  isHead: boolean
  isTail: boolean
}

export const EditorSlice = createSlice(
  {
    actions: {
      setEngine: ({ draft }, engine: Silk) => {
        draft.engine = engine as any
        engine.pencilMode = 'none'
      },
      setTool: ({ draft }, tool: Tool) => {
        draft.currentTool = tool

        if (tool === 'draw' || tool === 'erase') {
          draft.engine!.pencilMode = tool
        } else {
          draft.engine!.pencilMode = 'none'
        }
      },
      setFill: ({ draft }, fill: SilkValue.FillSetting | null) => {
        draft.currentFill = fill
      },
      setStroke: ({ draft }, stroke: SilkValue.BrushSetting | null) => {
        draft.currentStroke = stroke
      },
      setActiveLayer: ({ draft }, layerId: string) => {
        if (layerId === draft.engine?.activeLayer?.id) return

        draft.engine?.setActiveLayer(layerId)
        draft.activeLayerId = layerId
        draft.activeObjectId = null
        draft.activeObjectPointIndices = []
        draft.selectedFilterIds = {}
      },
      setActiveObject: ({ draft }, objectId: string | null) => {
        if (draft.activeObjectId !== objectId) {
          trace('activeObject changed', { objectId })
          draft.activeObjectPointIndices = []
        }

        draft.activeObjectId = objectId ?? null
      },
      setSelectedObjectPoints: ({ draft }, indices: number[]) => {
        draft.activeObjectPointIndices = indices
      },
      setVectorStroking: ({ draft }, state: VectorStroking | null) => {
        trace('vectorStroking changed', state)
        draft.vectorStroking = state
      },
      setVectorFocusing: ({ draft }, objectId: string | null) => {
        if (draft.vectorFocusing?.objectId !== objectId)
          log('vectorFocusing changed', { objectId })

        draft.vectorFocusing = objectId ? { objectId } : null
      },
      setSelectedFilterIds: (
        { draft },
        nextSelections: { [id: string]: true }
      ) => {
        trace('Selected filters changed', Object.keys(nextSelections))
        draft.selectedFilterIds = nextSelections
      },
      rerenderCanvas: debounce(
        ({ draft }: SliceActionContext<State>) => {
          draft.engine?.rerender()
        },
        100,
        true
      ),
      updateLayer: (
        { draft },
        layerId: string,
        proc: (layer: SilkEntity.LayerTypes) => void
      ) => {
        findLayer(draft.engine?.currentDocument, layerId)?.update(proc)
      },
      updateRasterLayer: (
        { draft },
        layerId: string,
        proc: (layer: SilkEntity.RasterLayer) => void
      ) => {
        const layer = findLayer(draft.engine?.currentDocument, layerId)
        if (layer?.layerType !== 'raster') return

        layer.update(proc)
      },
      updateVectorLayer: (
        { draft },
        layerId: string,
        proc: (layer: SilkEntity.VectorLayer) => void
      ) => {
        const layer = findLayer(draft.engine?.currentDocument, layerId)
        if (layer?.layerType !== 'vector') return

        layer.update(proc)
      },
      updateActiveObject: (
        { draft },
        proc: (object: SilkEntity.VectorObject) => void
      ) => {
        if (draft.engine?.activeLayer?.layerType !== 'vector') return

        const { activeLayer } = draft.engine
        const object = activeLayer.objects.find(
          (obj) => obj.id === draft.activeObjectId
        )

        if (object) proc(object as SilkEntity.VectorObject)
      },
      addPoint: (
        { draft },
        objectOrId: SilkEntity.VectorObject | string,
        segmentIndex: number,
        point: SilkEntity.Path.PathPoint
      ) => {
        if (draft.engine?.activeLayer?.layerType !== 'vector') return
        const { activeLayer } = draft.engine

        const object =
          typeof objectOrId === 'string'
            ? activeLayer?.objects.find(
                (obj) => obj.id === draft.activeObjectId
              )
            : objectOrId

        if (!object) throw new Error(`Object(id: ${objectOrId}) not found`)
        object.path.points.splice(segmentIndex, 0, point)
      },
      deleteSelectedFilters: ({ draft }) => {
        findLayer(draft.engine?.currentDocument, draft.activeLayerId)?.update(
          (layer) => {
            for (const filterId of Object.keys(draft.selectedFilterIds)) {
              const idx = layer.filters.findIndex((f) => f.id === filterId)
              if (idx === -1) continue

              layer.filters.splice(idx, 1)
            }
          }
        )
      },
      deleteSelectedObjectPoints: ({ draft }) => {
        const layer = draft.engine?.activeLayer
        if (!layer || layer.layerType !== 'vector') return

        const obj = layer.objects.find((obj) => obj.id === draft.activeObjectId)
        if (!obj) return

        const points: Array<SilkEntity.Path.PathPoint | null> = [
          ...obj.path.points,
        ]
        draft.activeObjectPointIndices.forEach((idx) => {
          points[idx] = null
        })

        obj.path.points = points.filter(
          (v): v is SilkEntity.Path.PathPoint => v != null
        )

        draft.activeObjectPointIndices = []

        draft.engine?.rerender()
      },
    },
    computed: {
      currentBrush: ({ engine }) => engine?.currentBrush ?? null,
      currentVectorBrush: ({ engine, activeObjectId }) => {
        if (engine?.activeLayer?.layerType !== 'vector')
          return engine?.brushSetting

        const object = engine?.activeLayer?.objects.find(
          (obj) => obj.id === activeObjectId
        )

        if (!object) return engine?.brushSetting ?? null
        return deepClone(object.brush)
      },
      currentVectorFill: ({ engine, currentFill, activeObjectId }) => {
        if (engine?.activeLayer?.layerType !== 'vector') return currentFill

        const object = engine?.activeLayer?.objects.find(
          (obj) => obj.id === activeObjectId
        )

        if (!object) return currentFill
        return currentFill
      },
      activeLayer: ({ engine }) => engine?.activeLayer,
      activeObject: ({
        engine,
        activeObjectId,
      }): SilkEntity.VectorObject | null => {
        if (engine?.activeLayer?.layerType !== 'vector') return null
        return engine?.activeLayer?.objects.find(
          (obj) => obj.id === activeObjectId
        ) as any
      },
    },
  },
  (): State => ({
    engine: null,
    currentTool: 'cursor',
    currentFill: null,
    currentStroke: null,
    activeLayerId: null,
    activeObjectId: null,
    activeObjectPointIndices: [],
    selectedFilterIds: {},
    vectorStroking: null,
    vectorFocusing: null,
    clipboard: null,
  })
)

const findLayer = (
  document: Draft<SilkEntity.Document> | undefined | null,
  layerId: string | null
) => {
  if (document == null || layerId === null) return

  const layer = document.layers.find((layer) => layer.id === layerId)

  if (!layer) {
    warn('Layer not found:', layerId)
    return
  }

  return layer
}
