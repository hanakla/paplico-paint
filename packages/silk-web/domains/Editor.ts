import { createSlice } from '@fleur/lys'
import type { Draft } from 'immer'
import { SliceActionContext } from '@fleur/lys/dist/slice'
import { debounce } from 'debounce'
import { Silk, SilkEntity, SilkValue } from 'silk-core'
import { deepClone } from '../utils/clone'
import { log, trace, warn } from '../utils/log'
import { assign } from '../utils/assign'

interface State {
  engine: Silk | null
  editorMode: EditorMode
  editorPage: EditorPage
  renderSetting: Silk.RenderSetting
  _currentDocument: SilkEntity.Document | null
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
  currentTheme: 'dark' | 'light'
}

type EditorMode = 'pc' | 'sp' | 'tablet'
type EditorPage = 'home' | 'app'
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
      setEngine: async ({ draft }, engine: Silk) => {
        draft.engine = engine as any

        engine.pencilMode = 'none'
        engine.renderSetting = { ...draft.renderSetting }
        engine.on('rerender', () => {
          trace('Canvas rerendered')
        })

        if (draft._currentDocument) {
          await engine.setDocument(draft._currentDocument as any)
          engine.setActiveLayer(draft._currentDocument.activeLayerId)
        }
      },
      setDocument: async ({ draft }, document: SilkEntity.Document) => {
        draft._currentDocument = document

        if (draft.engine) {
          await draft.engine.setDocument(document)
          draft.activeLayerId = document.activeLayerId
        }
      },
      setTheme: ({ draft }, theme: 'dark' | 'light') => {
        draft.currentTheme = theme
      },
      setEditorMode: ({ draft }, mode: EditorMode) => {},
      setEditorPage: ({ draft }, page: EditorPage) => {
        draft.editorPage = page
      },
      setRenderSetting: ({ draft }, setting: Partial<Silk.RenderSetting>) => {
        if (!draft.engine) return

        draft.engine.renderSetting = draft.renderSetting = assign(
          draft.engine.renderSetting,
          setting
        )

        draft.engine?.rerender()
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
      updateDocument: (
        { draft },
        proc: (document: SilkEntity.Document) => void,
        { skipRerender = false }: { skipRerender?: boolean } = {}
      ) => {
        if (!draft._currentDocument) return
        proc(draft._currentDocument as SilkEntity.Document)

        if (!skipRerender) {
          debouncing((engine) => engine?.rerender(), draft.engine)
        }
      },
      updateLayer: (
        { draft },
        layerId: string | null | undefined,
        proc: (layer: SilkEntity.LayerTypes) => void,
        { skipRerender = false }: { skipRerender?: boolean } = {}
      ) => {
        findLayer(draft.engine?.currentDocument, layerId)?.update(proc)

        if (!skipRerender) {
          debouncing((engine) => engine?.rerender(), draft.engine)
        }
      },
      updateRasterLayer: (
        { draft },
        layerId: string | null | undefined,
        proc: (layer: SilkEntity.RasterLayer) => void,
        { skipRerender = false }: { skipRerender?: boolean } = {}
      ) => {
        const layer = findLayer(draft.engine?.currentDocument, layerId)
        if (layer?.layerType !== 'raster') return

        layer.update(proc)

        if (!skipRerender) {
          debouncing((engine) => engine?.rerender(), draft.engine)
        }
      },
      updateVectorLayer: (
        { draft },
        layerId: string | null | undefined,
        proc: (layer: SilkEntity.VectorLayer) => void,
        { skipRerender = false }: { skipRerender?: boolean } = {}
      ) => {
        const layer = findLayer(draft.engine?.currentDocument, layerId)
        if (layer?.layerType !== 'vector') return

        layer.update(proc)

        if (!skipRerender) {
          debouncing((engine) => engine?.rerender(), draft.engine)
        }
      },
      updateFilter: (
        { draft },
        layerId: string | null,
        filterId: string | null,
        proc: (filter: SilkEntity.Filter) => void,
        { skipRerender = false }: { skipRerender?: boolean } = {}
      ) => {
        const layer = findLayer(draft.engine?.currentDocument, layerId)
        if (!layer) return

        const filter = layer.filters.find((filter) => filter.id === filterId)
        if (!filter) return

        proc(filter)

        if (!skipRerender) {
          debouncing((engine) => engine?.rerender(), draft.engine)
        }
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
      addLayer: (
        { draft },
        newLayer: SilkEntity.LayerTypes,
        { aboveLayerId }: { aboveLayerId?: string | null }
      ) => {
        draft.engine?.currentDocument?.addLayer(newLayer, { aboveLayerId })
        draft.engine?.setActiveLayer(newLayer.id)
        draft.engine?.rerender()
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
      deleteLayer: ({ draft }, layerId: string | null | undefined) => {
        if (!draft.engine?.currentDocument) return

        const { currentDocument } = draft.engine
        if (currentDocument.layers.length === 1) return

        const idx = findLayerIndex(currentDocument, layerId)
        if (idx === -1) return

        currentDocument.layers.splice(idx, 1)

        // ActiveLayerがなくなると画面がアになるので……
        const nextActiveLayer = currentDocument.layers[idx - 1]

        if (layerId === draft.activeLayerId) {
          draft.engine.setActiveLayer(nextActiveLayer.id)
          draft.activeLayerId = nextActiveLayer.id
        }
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
      defaultVectorBrush: (): Silk.CurrentBrushSetting => ({
        brushId: '@silk-paint/brush',
        color: { r: 26, g: 26, b: 26 },
        opacity: 1,
        weight: 1,
      }),
      currentDocument: ({ engine }) => engine?.currentDocument,
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
      thumbnailUrlOfLayer:
        ({ engine }) =>
        (layerId: string) =>
          engine?.previews.get(layerId),
    },
  },
  (): State => ({
    engine: null,
    _currentDocument: null,
    editorMode: 'sp',
    editorPage: 'app',
    currentTheme: 'light',
    renderSetting: { disableAllFilters: false, updateThumbnail: true },
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
  document: Draft<SilkEntity.Document> | null | undefined,
  layerId: string | null | undefined
) => {
  if (document == null || layerId === null) return

  const index = findLayerIndex(document, layerId)
  return document.layers[index]
}

const findLayerIndex = (
  document: Draft<SilkEntity.Document> | null | undefined,
  layerId: string | null | undefined
) => {
  if (document == null || layerId === null) return -1

  const index = document.layers.findIndex((layer) => layer.id === layerId)

  if (index === -1) {
    warn('Layer not found:', layerId)
  }

  return index
}

const debouncing = debounce(
  <T extends (...args: A[]) => void, A>(proc: T, ...args: A[]) => {
    proc(...args)
  },
  100
)
