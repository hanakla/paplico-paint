import { createSlice } from '@fleur/lys'
import { SliceActionContext } from '@fleur/lys/dist/slice'
import { Restaurant } from '@styled-icons/remix-line'
import { debounce } from 'debounce'
import { Silk, SilkEntity, SilkValue } from '../../silk-core/src'
import { SilkEngine } from '../../silk-core/src/engine/Engine'
import { deepClone } from '../utils/clone'
import { log } from '../utils/log'

interface State {
  engine: Silk | null
  currentTool: Tool
  currentFill: SilkValue.FillSetting | null
  currentStroke: SilkValue.BrushSetting | null
  activeObjectId: string | null
  activeObjectPointIndices: ('head' | number)[]
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
        draft.activeObjectId = null
      },
      setActiveObject: ({ draft }, objectId: string | null) => {
        log('activeObject changed', { objectId })
        draft.activeObjectId = objectId ?? null
      },
      setSelectedObjectPoints: ({ draft }, indices: ('head' | number)[]) => {
        draft.activeObjectPointIndices = indices
      },
      setVectorStroking: ({ draft }, state: VectorStroking | null) => {
        log('vectorStroking changed', state)
        draft.vectorStroking = state
      },
      setVectorFocusing: ({ draft }, objectId: string | null) => {
        log('vectorFocusing changed', { objectId })
        draft.vectorFocusing = objectId ? { objectId } : null
      },
      rerenderCanvas: debounce(
        ({ draft }: SliceActionContext<State>) => {
          draft.engine?.rerender()
        },
        100,
        true
      ),
      // updateLayer: (
      //   { draft },
      //   layerId: string,
      //   proc: (layer: SilkEntity.LayerTypes) => void
      // ) => {
      //   const layer = draft.engine?.currentDocument?.layers.find(
      //     (layer) => layer.id === layerId
      //   )
      //   if (!layer) {
      //     console.warn('Layer not found')
      //     return
      //   }

      //   ;(layer as any as SilkEntity.LayerTypes).update(proc)
      // },
      updateRasterLayer: (
        { draft },
        layerId: string,
        proc: (layer: SilkEntity.RasterLayer) => void
      ) => {
        const layer = draft.engine?.currentDocument?.layers.find(
          (layer) => layer.id === layerId
        )
        if (!layer) {
          console.warn('Layer not found')
          return
        }

        if (layer.layerType !== 'raster') return
        layer.update(proc)
      },
      updateVectorLayer: (
        { draft },
        layerId: string,
        proc: (layer: SilkEntity.VectorLayer) => void
      ) => {
        const layer = draft.engine?.currentDocument?.layers.find(
          (layer) => layer.id === layerId
        )
        if (!layer) {
          console.warn('Layer not found')
          return
        }

        if (layer.layerType !== 'vector') return
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
      deleteSelectedPoints: ({ draft }) => {
        const layer = draft.engine?.activeLayer
        if (!layer || layer.layerType !== 'vector') return

        const obj = layer.objects.find((obj) => obj.id === draft.activeObjectId)
        if (!obj) return

        const points: Array<SilkEntity.Path.PathPoint | null> = [
          ...obj.path.points,
        ]
        draft.activeObjectPointIndices.forEach((idx) => {
          if (idx === 'head') return
          points[idx] = null
        })

        obj.path.points = points.filter(
          (v): v is SilkEntity.Path.PathPoint => v != null
        )
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
    activeObjectId: null,
    activeObjectPointIndices: [],
    vectorStroking: null,
    vectorFocusing: null,
    clipboard: null,
  })
)
