import { minOps, selector } from '@fleur/fleur'
import { debounce } from 'debounce'
import { Silk, SilkEntity, SilkValue } from 'silk-core'
import { assign } from '../utils/assign'
import { deepClone } from '../utils/clone'
import { log, trace, warn } from '../utils/log'

type EditorMode = 'pc' | 'sp' | 'tablet'
type EditorPage = 'home' | 'app'
type Tool = 'cursor' | 'shape-pen' | 'draw' | 'erase'
type VectorStroking = {
  objectId: string
  selectedPointIndex: number
  isHead: boolean
  isTail: boolean
}

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

const debouncing = debounce(
  <T extends (...args: A) => void, A extends Array<any>>(proc: T) => {
    // console.log(proc, args)
    return (...args: A) => proc(...args)
  },
  100
)

const [EditorStore, editorOps] = minOps('Editor', {
  initialState: (): State => ({
    engine: null,
    _currentDocument: null,
    editorMode: 'sp',
    editorPage: 'home',
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
  }),
  ops: {
    setEngine: async ({ state }, engine: Silk) => {
      state.engine = engine as any

      engine.pencilMode = 'none'
      engine.renderSetting = { ...state.renderSetting }
      engine.on('rerender', () => {
        trace('Canvas rerendered')
      })

      if (state._currentDocument) {
        await engine.setDocument(state._currentDocument as any)
        engine.setActiveLayer(state._currentDocument.activeLayerId)
      }
    },
    setDocument: async ({ state }, document: SilkEntity.Document) => {
      state._currentDocument = document

      if (state.engine) {
        await state.engine.setDocument(document)
        state.activeLayerId = document.activeLayerId
      }
    },
    setTheme: ({ state }, theme: 'dark' | 'light') => {
      state.currentTheme = theme
    },
    setEditorMode: ({ state }, mode: EditorMode) => {},
    setEditorPage: ({ state }, page: EditorPage) => {
      state.editorPage = page
    },
    setRenderSetting: ({ state }, setting: Partial<Silk.RenderSetting>) => {
      if (!state.engine) return

      state.engine.renderSetting = state.renderSetting = assign(
        state.engine.renderSetting,
        setting
      )

      state.engine?.rerender()
    },
    setTool: ({ state }, tool: Tool) => {
      state.currentTool = tool

      if (tool === 'draw' || tool === 'erase') {
        state.engine!.pencilMode = tool
      } else {
        state.engine!.pencilMode = 'none'
      }
    },
    setFill: ({ state }, fill: SilkValue.FillSetting | null) => {
      state.currentFill = fill
    },
    setStroke: ({ state }, stroke: SilkValue.BrushSetting | null) => {
      state.currentStroke = stroke
    },
    setActiveLayer: ({ state }, layerId: string) => {
      if (layerId === state.engine?.activeLayer?.id) return

      state.engine?.setActiveLayer(layerId)
      state.activeLayerId = layerId
      state.activeObjectId = null
      state.activeObjectPointIndices = []
      state.selectedFilterIds = {}
    },
    setActiveObject: ({ state }, objectId: string | null) => {
      if (state.activeObjectId !== objectId) {
        trace('activeObject changed', { objectId })
        state.activeObjectPointIndices = []
      }

      state.activeObjectId = objectId ?? null
    },
    setSelectedObjectPoints: ({ state }, indices: number[]) => {
      state.activeObjectPointIndices = indices
    },
    setVectorStroking: ({ state }, vectorStroking: VectorStroking | null) => {
      trace('vectorStroking changed', vectorStroking)
      state.vectorStroking = vectorStroking
    },
    setVectorFocusing: ({ state }, objectId: string | null) => {
      if (state.vectorFocusing?.objectId !== objectId)
        log('vectorFocusing changed', { objectId })

      state.vectorFocusing = objectId ? { objectId } : null
    },
    setSelectedFilterIds: (
      { state },
      nextSelections: { [id: string]: true }
    ) => {
      trace('Selected filters changed', Object.keys(nextSelections))
      state.selectedFilterIds = nextSelections
    },
    rerenderCanvas: debouncing(({ state }) => {
      state.engine?.rerender()
    }) as any,
    updateDocument: (
      { state },
      proc: (document: SilkEntity.Document) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      if (!state._currentDocument) return
      proc(state._currentDocument as SilkEntity.Document)

      if (!skipRerender) {
        debouncing((engine) => engine?.rerender(), state.engine)
      }
    },
    updateLayer: (
      { state },
      layerId: string | null | undefined,
      proc: (layer: SilkEntity.LayerTypes) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      findLayer(state.engine?.currentDocument, layerId)?.update(proc)

      if (!skipRerender) {
        debouncing((engine) => engine?.rerender(), state.engine)
      }
    },
    updateRasterLayer: (
      { state },
      layerId: string | null | undefined,
      proc: (layer: SilkEntity.RasterLayer) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      const layer = findLayer(state.engine?.currentDocument, layerId)
      if (layer?.layerType !== 'raster') return

      layer.update(proc)

      if (!skipRerender) {
        debouncing((engine) => engine?.rerender(), state.engine)
      }
    },
    updateVectorLayer: (
      { state },
      layerId: string | null | undefined,
      proc: (layer: SilkEntity.VectorLayer) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      const layer = findLayer(state.engine?.currentDocument, layerId)
      if (layer?.layerType !== 'vector') return

      layer.update(proc)

      if (!skipRerender) {
        debouncing((engine) => engine?.rerender(), state.engine)
      }
    },
    updateFilter: (
      { state },
      layerId: string | null,
      filterId: string | null,
      proc: (filter: SilkEntity.Filter) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      const layer = findLayer(state.engine?.currentDocument, layerId)
      if (!layer) return

      const filter = layer.filters.find((filter) => filter.id === filterId)
      if (!filter) return

      proc(filter)

      if (!skipRerender) {
        debouncing((engine) => engine?.rerender(), state.engine)
      }
    },
    updateActiveObject: (
      { state },
      proc: (object: SilkEntity.VectorObject) => void
    ) => {
      if (state.engine?.activeLayer?.layerType !== 'vector') return

      const { activeLayer } = state.engine
      const object = activeLayer.objects.find(
        (obj) => obj.id === state.activeObjectId
      )

      if (object) proc(object as SilkEntity.VectorObject)
    },
    addLayer: (
      { state },
      newLayer: SilkEntity.LayerTypes,
      { aboveLayerId }: { aboveLayerId?: string | null }
    ) => {
      state.engine?.currentDocument?.addLayer(newLayer, { aboveLayerId })
      state.engine?.setActiveLayer(newLayer.id)
      state.engine?.rerender()
    },
    addPoint: (
      { state },
      objectOrId: SilkEntity.VectorObject | string,
      segmentIndex: number,
      point: SilkEntity.Path.PathPoint
    ) => {
      if (state.engine?.activeLayer?.layerType !== 'vector') return
      const { activeLayer } = state.engine

      const object =
        typeof objectOrId === 'string'
          ? activeLayer?.objects.find((obj) => obj.id === state.activeObjectId)
          : objectOrId

      if (!object) throw new Error(`Object(id: ${objectOrId}) not found`)
      object.path.points.splice(segmentIndex, 0, point)
    },
    deleteLayer: ({ state }, layerId: string | null | undefined) => {
      if (!state.engine?.currentDocument) return

      const { currentDocument } = state.engine
      if (currentDocument.layers.length === 1) return

      const idx = findLayerIndex(currentDocument, layerId)
      if (idx === -1) return

      currentDocument.layers.splice(idx, 1)

      // ActiveLayerがなくなると画面がアになるので……
      const nextActiveLayer =
        currentDocument.layers[idx - 1] ?? currentDocument.layers.slice(-1)

      if (layerId === state.activeLayerId) {
        state.engine.setActiveLayer(nextActiveLayer.id)
        state.activeLayerId = nextActiveLayer.id
      }
    },
    deleteSelectedFilters: ({ state }) => {
      findLayer(state.engine?.currentDocument, state.activeLayerId)?.update(
        (layer) => {
          for (const filterId of Object.keys(state.selectedFilterIds)) {
            const idx = layer.filters.findIndex((f) => f.id === filterId)
            if (idx === -1) continue

            layer.filters.splice(idx, 1)
          }
        }
      )
    },
    deleteSelectedObjectPoints: ({ state }) => {
      const layer = state.engine?.activeLayer
      if (!layer || layer.layerType !== 'vector') return

      const obj = layer.objects.find((obj) => obj.id === state.activeObjectId)
      if (!obj) return

      const points: Array<SilkEntity.Path.PathPoint | null> = [
        ...obj.path.points,
      ]
      state.activeObjectPointIndices.forEach((idx) => {
        points[idx] = null
      })

      obj.path.points = points.filter(
        (v): v is SilkEntity.Path.PathPoint => v != null
      )

      state.activeObjectPointIndices = []

      state.engine?.rerender()
    },
  },
})

export { EditorStore, editorOps }

export const EditorSelector = {
  currentBrush: selector(
    (get) => get(EditorStore).engine?.currentBrush ?? null
  ),
  currentVectorBrush: selector((get) => {
    const { engine, activeObjectId } = get(EditorStore)

    if (engine?.activeLayer?.layerType !== 'vector') return engine?.brushSetting

    const object = engine?.activeLayer?.objects.find(
      (obj) => obj.id === activeObjectId
    )

    if (!object) return engine?.brushSetting ?? null
    return deepClone(object.brush)
  }),
  currentVectorFill: selector((get) => {
    const { engine, currentFill, activeObjectId } = get(EditorStore)
    if (engine?.activeLayer?.layerType !== 'vector') return currentFill

    const object = engine?.activeLayer?.objects.find(
      (obj) => obj.id === activeObjectId
    )

    if (!object) return currentFill
    return currentFill
  }),
  defaultVectorBrush: selector(
    (): Silk.CurrentBrushSetting => ({
      brushId: '@silk-paint/brush',
      color: { r: 26, g: 26, b: 26 },
      opacity: 1,
      weight: 1,
    })
  ),
  currentDocument: selector((get) => get(EditorStore).engine?.currentDocument),
  activeLayer: selector((get) => get(EditorStore).engine?.activeLayer),
  activeObject: selector((get): SilkEntity.VectorObject | null => {
    const { engine, activeObjectId } = get(EditorStore)

    if (engine?.activeLayer?.layerType !== 'vector') return null
    return engine?.activeLayer?.objects.find(
      (obj) => obj.id === activeObjectId
    ) as any
  }),
  thumbnailUrlOfLayer: selector((get, layerId: string) => {
    const { engine } = get(EditorStore)
    return (layerId: string) => engine?.previews.get(layerId)
  }),
}

const findLayer = (
  document: SilkEntity.Document | null | undefined,
  layerId: string | null | undefined
) => {
  if (document == null || layerId === null) return

  const index = findLayerIndex(document, layerId)
  return document.layers[index]
}

const findLayerIndex = (
  document: SilkEntity.Document | null | undefined,
  layerId: string | null | undefined
) => {
  if (document == null || layerId === null) return -1

  const index = document.layers.findIndex((layer) => layer.id === layerId)

  if (index === -1) {
    warn('Layer not found:', layerId)
  }

  return index
}

// const debouned = debounce((f: () => void) => {
//   f()
// }, 100)
