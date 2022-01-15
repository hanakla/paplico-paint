import { action, actions, operations, reducerStore } from '@fleur/fleur'
import { debounce } from 'debounce'
import { Silk, SilkEntity, SilkValue } from 'silk-core'
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

export const EditorOps = operations({
  setEngine(x, engine: Silk) {
    x.dispatch(a.setEngine, engine)
  },
  rerenderCanvas: debounce(
    (x) => {
      x.getStore(EditorStore).state.engine?.rerender()
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
    proc: (layer: SilkEntity.RasterLayer) => void
  ) => {
    const layer = findLayer(draft.engine?.currentDocument, layerId)
    if (layer?.layerType !== 'raster') return

    layer.update(proc)
  },
  updateVectorLayer: (
    { draft },
    layerId: string | null | undefined,
    proc: (layer: SilkEntity.VectorLayer) => void
  ) => {
    const layer = findLayer(draft.engine?.currentDocument, layerId)
    if (layer?.layerType !== 'vector') return

    layer.update(proc)
  },
  updateFilter: (
    { draft },
    layerId: string | null,
    filterId: string | null,
    proc: (filter: SilkEntity.Filter) => void
  ) => {
    const layer = findLayer(draft.engine?.currentDocument, layerId)
    if (!layer) return

    const filter = layer.filters.find((filter) => filter.id === filterId)
    if (!filter) return

    proc(filter)
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
  }
})

const a = actions('Editor', {
  setEngine: action<Silk>(),
  setDocument: action<SilkEntity.Document>(),
  setTheme: action<'dark' | 'light'>(),
  setEditorMode: action<EditorMode>(),
  setEditorPage: action<EditorPage>(),
  setRenderSetting: action<Partial<Silk.RenderSetting>>(),
  setTool: action<Tool>(),
  setFill: action<SilkValue.FillSetting | null>(),
  setStroke: action<SilkValue.BrushSetting | null>(),
  setActiveLayer: action<string>(),
  setActiveObject: action<string | null>(),
  setSelectedObjectPoints: action<number[]>(),
  setVectorStroking: action<VectorStroking | null>(),
  setVectorFocusing: action<string | null>(),
  setSelectedFilterIds: action<{ [id: string]: true }>(),
})

export const EditorStore = reducerStore(
  'Editor',
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
  .listen(a.setEngine, (s, engine) => {
    s.engine = engine as any

    engine.pencilMode = 'none'
    engine.renderSetting = { ...s.renderSetting }
    engine.on('rerender', () => {
      trace('Canvas rerendered')
    })

    if (s._currentDocument) {
      await engine.setDocument(s._currentDocument as any)
      engine.setActiveLayer(s._currentDocument.activeLayerId)
    }
  })
  .listen(a.setDocument, async (s, doc) => {
    s._currentDocument = doc

    if (s.engine) {
      await s.engine.setDocument(doc)
      s.activeLayerId = doc.activeLayerId
    }
  })
  .listen(a.setTheme, (s, theme: 'dark' | 'light') => {
    s.currentTheme = theme
  })
  .listen(a.setEditorMode, (s, mode: EditorMode) => {
    s.editorMode = mode
  })
  .listen(a.setEditorPage, (s, page) => {
    s.editorPage = page
  })
  .listen(a.setRenderSetting, (s, setting) => {
    if (!s.engine) return

    s.engine.renderSetting = s.renderSetting = assign(
      s.engine.renderSetting,
      setting
    )

    s.engine?.rerender()
  })
  .listen(a.setTool, (s, tool) => {
    s.currentTool = tool

    if (tool === 'draw' || tool === 'erase') {
      s.engine!.pencilMode = tool
    } else {
      s.engine!.pencilMode = 'none'
    }
  })
  .listen(a.setFill, (s, fill) => {
    s.currentFill = fill
  })
  .listen(a.setStroke, (s, stroke) => {
    s.currentStroke = stroke
  })
  .listen(a.setActiveLayer, (s, layerId) => {
    if (layerId === s.engine?.activeLayer?.id) return

    s.engine?.setActiveLayer(layerId)
    s.activeLayerId = layerId
    s.activeObjectId = null
    s.activeObjectPointIndices = []
    s.selectedFilterIds = {}
  })
  .listen(a.setActiveObject, (s, objectId: string | null) => {
    if (s.activeObjectId !== objectId) {
      trace('activeObject changed', { objectId })
      s.activeObjectPointIndices = []
    }

    s.activeObjectId = objectId ?? null
  })
  .listen(a.setSelectedObjectPoints, (s, indices) => {
    s.activeObjectPointIndices = indices
  })
  .listen(a.setVectorStroking, (s, state) => {
    trace('vectorStroking changed', state)
    s.vectorStroking = state
  })
  .listen(a.setVectorFocusing, (s, objectId) => {
    if (s.vectorFocusing?.objectId !== objectId)
      log('vectorFocusing changed', { objectId })

    s.vectorFocusing = objectId ? { objectId } : null
  })
  .listen(a.setSelectedFilterIds, (s, nextSelections) => {
    trace('Selected filters changed', Object.keys(nextSelections))
    s.selectedFilterIds = nextSelections
  })
