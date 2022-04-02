import { minOps, selector } from '@fleur/fleur'
import { debounce } from 'debounce'
import {
  Session,
  Silk3,
  SilkEntity,
  SilkValue,
  RenderStrategies,
  IRenderStrategy,
} from 'silk-core'

import { BrushSetting } from '🙌/../silk-core/dist/Value'
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
  engine: Silk3 | null
  session: Session | null
  renderStrategy: RenderStrategies.DifferenceRender | null

  editorMode: EditorMode
  editorPage: EditorPage
  renderSetting: Silk.RenderSetting
  currentDocument: SilkEntity.Document | null
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

export const [EditorStore, editorOps] = minOps('Editor', {
  initialState: (): State => ({
    engine: null,
    session: null,
    renderStrategy: null,

    currentDocument: null,
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
    // #region Engine & Session
    initEngine: (
      x,
      {
        engine,
        session,
        strategy,
      }: {
        engine: Silk3
        session: Session
        strategy: IRenderStrategy
      }
    ) => {
      session.pencilMode = 'none'
      session.renderSetting = x.state.renderSetting

      engine.on('rerender', () => {
        trace('Canvas rerendered')
      })

      session.on('activeLayerChanged', (s) => {
        if (x.getState().activeLayerId === s.activeLayerId) return

        x.commit({
          activeLayerId: s.activeLayerId,
          activeObjectId: null,
          activeObjectPointIndices: [],
        })
      })

      session.on('renderSettingChanged', (s) => {
        const { currentDocument, renderStrategy } = x.getState()
        if (!currentDocument || !renderStrategy) return

        engine.render(
          currentDocument as unknown as SilkEntity.Document,
          renderStrategy
        )
      })

      x.commit({
        engine,
        session,
        renderStrategy: strategy as RenderStrategies.DifferenceRender,
      })
    },
    async setDocument(x, document: SilkEntity.Document) {
      x.commit({ currentDocument: document })

      if (x.state.session) {
        x.commit((draft) => {
          draft.session!.setDocument(document)
          draft.activeLayerId = document.activeLayerId
        })
      }
    },
    setRenderSetting: (x, setting: Partial<Silk3.RenderSetting>) => {
      if (!x.state.engine || !x.state.session) return

      x.commit((d) => {
        d.session?.setRenderSetting(setting)
      })

      x.executeOperation(editorOps.rerenderCanvas)
    },
    setTool: (x, tool: Tool) => {
      x.commit((d) => {
        d.currentTool = tool

        if (tool === 'draw' || tool === 'erase') {
          d.session!.pencilMode = tool
        } else {
          d.session!.pencilMode = 'none'
        }
      })
    },
    rerenderCanvas: (x) => {
      if (
        !x.state.engine ||
        !x.state.currentDocument ||
        !x.state.renderStrategy
      )
        return

      x.state.engine.render(
        x.state.currentDocument as unknown as SilkEntity.Document,
        x.state.renderStrategy
      )
    },
    // #endregion Engine & Session

    // #region UI
    setTheme: (x, theme: 'dark' | 'light') => {
      x.commit({ currentTheme: theme })
    },
    setEditorMode: ({ state }, mode: EditorMode) => {},
    setEditorPage: (x, page: EditorPage) => {
      x.commit({ editorPage: page })
    },
    // #endregion

    // #region Paint tools and Session
    setFill: (x, fill: SilkValue.FillSetting | null) => {
      x.commit({ currentFill: fill })
    },
    setStroke: (x, stroke: SilkValue.BrushSetting | null) => {
      x.commit({ currentStroke: stroke })
    },
    setBrushSetting(x, setting: Partial<BrushSetting>) {
      x.commit((draft) => {
        draft.session!.brushSetting = assign(
          draft.session!.brushSetting,
          setting
        )
      })
    },

    setActiveLayer: (x, layerId: string) => {
      if (layerId === x.state.session?.activeLayerId) return

      x.commit((draft) => {
        if (draft.session) draft.session.activeLayerId = layerId
        draft.activeLayerId = layerId
        draft.activeObjectId = null
        draft.activeObjectPointIndices = []
        draft.selectedFilterIds = {}
      })
    },
    setActiveObject: (x, objectId: string | null) => {
      if (x.state.activeObjectId !== objectId) {
        trace('activeObject changed', { objectId })
        x.commit({ activeObjectPointIndices: [] })
      }

      x.commit({ activeObjectId: objectId ?? null })
    },
    setSelectedObjectPoints: (x, indices: number[]) => {
      x.commit({ activeObjectPointIndices: indices })
    },
    setVectorStroking: (x, vectorStroking: VectorStroking | null) => {
      trace('vectorStroking changed', vectorStroking)
      x.commit({ vectorStroking })
    },
    setVectorFocusing: (x, objectId: string | null) => {
      if (x.state.vectorFocusing?.objectId !== objectId)
        log('vectorFocusing changed', { objectId })

      x.commit({ vectorFocusing: objectId ? { objectId } : null })
    },
    setSelectedFilterIds: (x, nextSelections: { [id: string]: true }) => {
      trace('Selected filters changed', Object.keys(nextSelections))
      x.commit({ selectedFilterIds: nextSelections })
    },
    // #endregion

    // #region Document controls
    updateDocument: (
      x,
      proc: (document: SilkEntity.Document) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      if (!x.state.currentDocument) return

      x.commit((draft) => proc(draft.currentDocument as SilkEntity.Document))

      !skipRerender && x.executeOperation(editorOps.rerenderCanvas)
    },
    updateLayer: (
      x,
      layerId: string | null | undefined,
      proc: (layer: SilkEntity.LayerTypes) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      layerId && x.state.renderStrategy!.markUpdatedLayerId(layerId)

      x.commit((d) => {
        findLayer(d.currentDocument, layerId)?.update(proc)
        layerId && d.renderStrategy!.markUpdatedLayerId(layerId)
      })

      !skipRerender && x.executeOperation(editorOps.rerenderCanvas)
    },
    updateRasterLayer: (
      x,
      layerId: string | null | undefined,
      proc: (layer: SilkEntity.RasterLayer) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      if (!x.state.currentDocument) return

      x.commit((d) => {
        const layer = findLayer(
          x.state.currentDocument as unknown as SilkEntity.Document,
          layerId
        )
        if (layer?.layerType !== 'raster') return

        layer.update(proc)
        layerId && d.renderStrategy!.markUpdatedLayerId(layerId)
      })

      !skipRerender && x.executeOperation(editorOps.rerenderCanvas)
    },
    updateVectorLayer: (
      x,
      layerId: string | null | undefined,
      proc: (layer: SilkEntity.VectorLayer) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      x.commit((d) => {
        const layer = findLayer(d.currentDocument, layerId)
        if (layer?.layerType !== 'vector') return

        layer.update(proc)

        layerId && d.renderStrategy!.markUpdatedLayerId(layerId)
      })

      !skipRerender && x.executeOperation(editorOps.rerenderCanvas)
    },
    updateFilter: (
      x,
      layerId: string | null,
      filterId: string | null,
      proc: (filter: SilkEntity.Filter) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      x.commit((d) => {
        const layer = findLayer(d.session?.document, layerId)
        if (!layer) return

        const filter = layer.filters.find((filter) => filter.id === filterId)
        if (!filter) return

        proc(filter)

        layerId && d.renderStrategy!.markUpdatedLayerId(layerId)
      })

      !skipRerender && x.executeOperation(editorOps.rerenderCanvas)
    },
    updateActiveObject: (
      x,
      proc: (object: SilkEntity.VectorObject) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      x.commit((d) => {
        if (d.session?.activeLayer?.layerType !== 'vector') return

        const layerId = d.session?.activeLayerId
        layerId && d.renderStrategy!.markUpdatedLayerId(layerId)

        const { activeLayer } = d.session
        const object = activeLayer.objects.find(
          (obj) => obj.id === d.activeObjectId
        )

        if (object) proc(object as SilkEntity.VectorObject)
      })

      !skipRerender && x.executeOperation(editorOps.rerenderCanvas)
    },
    addLayer: (
      x,
      newLayer: SilkEntity.LayerTypes,
      { aboveLayerId }: { aboveLayerId?: string | null }
    ) => {
      x.commit((d) => {
        d.session!.document?.addLayer(newLayer, { aboveLayerId })
        d.session!.activeLayerId = newLayer.id
        d.engine!.render(d.currentDocument!, d.session?.renderStrategy!)

        d.renderStrategy?.markUpdatedLayerId(newLayer.id)
      })
    },
    addPoint: (
      x,
      objectOrId: SilkEntity.VectorObject | string,
      segmentIndex: number,
      point: SilkEntity.Path.PathPoint
    ) => {
      x.commit((d) => {
        if (!d.engine || d.session?.activeLayer?.layerType !== 'vector') return

        const { activeLayer } = d.session
        const object =
          typeof objectOrId === 'string'
            ? activeLayer?.objects.find((obj) => obj.id === d.activeObjectId)
            : objectOrId
        if (!object) throw new Error(`Object(id: ${objectOrId}) not found`)
        object.path.points.splice(segmentIndex, 0, point)

        d.renderStrategy?.markUpdatedLayerId(d.session.activeLayerId!)
      })

      x.executeOperation(editorOps.rerenderCanvas)
    },
    deleteLayer: (x, layerId: string | null | undefined) => {
      x.commit((d) => {
        if (!d.session?.document) return

        const { document } = d.session
        if (document.layers.length === 1) return

        const idx = findLayerIndex(document, layerId)
        if (idx === -1) return

        document.layers.splice(idx, 1)

        // ActiveLayerがなくなると画面がアになるので……
        const nextActiveLayer =
          document.layers[idx - 1] ?? document.layers.slice(-1)
        if (layerId === d.activeLayerId) {
          d.session.activeLayerId = nextActiveLayer.id
          d.activeLayerId = nextActiveLayer.id
        }
      })

      x.executeOperation(editorOps.rerenderCanvas)
    },
    deleteSelectedFilters: (x) => {
      x.commit((d) => {
        findLayer(d.currentDocument, d.activeLayerId)?.update((layer) => {
          for (const filterId of Object.keys(d.selectedFilterIds)) {
            const idx = layer.filters.findIndex((f) => f.id === filterId)
            if (idx === -1) continue
            layer.filters.splice(idx, 1)
          }
        })
      })

      x.executeOperation(editorOps.rerenderCanvas)
    },
    deleteSelectedObjectPoints: (x) => {
      x.commit((d) => {
        const layer = d.session?.activeLayer
        if (!layer || layer.layerType !== 'vector') return

        const obj = layer.objects.find((obj) => obj.id === d.activeObjectId)
        if (!obj) return

        const points: Array<SilkEntity.Path.PathPoint | null> = [
          ...obj.path.points,
        ]

        d.activeObjectPointIndices.forEach((idx) => {
          points[idx] = null
        })

        obj.path.points = points.filter(
          (v): v is SilkEntity.Path.PathPoint => v != null
        )

        d.activeObjectPointIndices = []
      })

      x.executeOperation(editorOps.rerenderCanvas)
    },
    // #endregion
  },
})

export const EditorSelector = {
  currentBrush: selector(
    (get) => get(EditorStore).session?.currentBursh ?? null
  ),
  currentVectorBrush: selector((get) => {
    const { session, activeObjectId } = get(EditorStore)

    if (session?.activeLayer?.layerType !== 'vector')
      return session?.brushSetting

    const object = session?.activeLayer?.objects.find(
      (obj) => obj.id === activeObjectId
    )

    if (!object) return session?.brushSetting ?? null
    return deepClone(object.brush)
  }),
  currentVectorFill: selector((get) => {
    const { session, currentFill, activeObjectId } = get(EditorStore)
    if (session?.activeLayer?.layerType !== 'vector') return currentFill

    const object = session?.activeLayer?.objects.find(
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
  currentSession: selector((get) => get(EditorStore).session),
  currentDocument: selector((get) => get(EditorStore).session?.document),
  activeLayer: selector((get) => get(EditorStore).session?.activeLayer),
  activeObject: selector((get): SilkEntity.VectorObject | null => {
    const { session, activeObjectId } = get(EditorStore)

    if (session?.activeLayer?.layerType !== 'vector') return null
    return session?.activeLayer?.objects.find(
      (obj) => obj.id === activeObjectId
    ) as any
  }),
  thumbnailUrlOfLayer: selector((get, layerId: string) => {
    const { engine } = get(EditorStore)
    return (layerId: string) => engine?.previews?.get(layerId)
  }),

  // #region Session proxies
  brushSetting: selector((get) => get(EditorStore).session?.brushSetting),
  currentLayerBBox: selector(
    (get) => get(EditorStore).session?.currentLayerBBox
  ),
  // #endregion

  // Engine proxies
  getAvailableFilters: selector(
    (get) => get(EditorStore).engine?.toolRegistry.registeredFilters ?? []
  ),
  getFilterInstance: selector((get, id) =>
    get(EditorStore).engine?.toolRegistry.getFilterInstance(id)
  ),
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

console.log(debouncing((x: any) => {}) as any)
