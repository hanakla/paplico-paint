import { minOps, selector } from '@fleur/fleur'
import arrayMove from 'array-move'
import { debounce } from 'debounce'
import { nanoid } from 'nanoid'
import {
  SilkSession,
  Silk3,
  SilkDOM,
  SilkValue,
  RenderStrategies,
  IRenderStrategy,
  SilkSerializer,
  SilkDOMDigger,
  SilkCommands,
} from 'silk-core'

import { BrushSetting } from '🙌/../silk-core/dist/Value'
import { connectIdb } from '🙌/infra/indexeddb'
import { LocalStorage } from '🙌/infra/LocalStorage'
import { any } from '🙌/utils/anyOf'
import { shallowEquals } from '🙌/utils/object'
import { deepClone } from '../utils/clone'
import { log, trace, warn } from '../utils/log'

type EditorMode = 'pc' | 'sp' | 'tablet'
type EditorPage = 'home' | 'app'
type Tool = 'cursor' | 'shape-pen' | 'draw' | 'erase' | 'point-cursor'
type VectorStroking = {
  objectId: string
  selectedPointIndex: number
  isHead: boolean
  isTail: boolean
}

interface State {
  savedItems: []

  engine: Silk3 | null
  session: SilkSession | null

  sessions: Record<
    string,
    {
      sid: string
      session: SilkSession
      renderStrategy: RenderStrategies.DifferenceRender | null
      currentFileHandler: FileSystemFileHandle | null
      canvasScale: number
      canvasPosition: { x: number; y: number }
    }
  >
  activeSessionId: string | null

  renderStrategy: RenderStrategies.DifferenceRender | null

  currentFileHandler: FileSystemFileHandle | null

  currentTheme: 'dark' | 'light'
  editorMode: EditorMode
  editorPage: EditorPage
  canvasScale: number
  canvasPosition: { x: number; y: number }

  renderSetting: Silk3.RenderSetting
  currentDocument: SilkDOM.Document | null
  currentTool: Tool
  currentFill: SilkValue.FillSetting | null
  currentStroke: SilkValue.BrushSetting | null
  activeLayerPath: string[] | null
  activeObjectId: string | null
  activeObjectPointIndices: number[]
  selectedFilterIds: { [id: string]: true | undefined }
  vectorStroking: VectorStroking | null
  vectorFocusing: { objectId: string } | null
  clipboard: SilkDOM.VectorObject | null

  vectorLastUpdated: number

  selectedLayerUids: []
}

const debouncing = debounce(
  <T extends (...args: A) => void, A extends Array<any>>(proc: T) => {
    // console.log(proc, args)
    return (...args: A) => proc(...args)
  },
  100
)

const autoSaveWorker =
  typeof window === 'undefined'
    ? null
    : new Worker(new URL('./EditorStable/autoSaveWorker', import.meta.url))

export const [EditorStore, EditorOps] = minOps('Editor', {
  initialState: (): State => ({
    savedItems: [],

    engine: null,
    session: null,
    renderStrategy: null,

    sessions: Object.create(null),
    activeSessionId: null,
    currentFileHandler: null,

    currentTheme: 'light',
    editorMode: 'sp',
    editorPage: 'home', // process.env.NODE_ENV === 'development' ? 'app' : 'home',
    canvasScale: 1,
    canvasPosition: { x: 0, y: 0 },

    currentDocument: null,

    renderSetting: { disableAllFilters: false, updateThumbnail: true },
    currentTool: 'cursor',
    currentFill: null,
    currentStroke: null,
    activeLayerPath: null,
    activeObjectId: null,
    activeObjectPointIndices: [],
    selectedFilterIds: {},
    vectorStroking: null,
    vectorFocusing: null,
    clipboard: null,
    vectorLastUpdated: 0,

    selectedLayerUids: [],
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
        session: SilkSession
        strategy: IRenderStrategy
      }
    ) => {
      session.pencilMode = 'none'
      session.renderSetting = x.state.renderSetting

      engine.on('rerender', () => {
        // trace('Canvas rerendered')
      })

      session.on('activeLayerChanged', (s) => {
        if (shallowEquals(x.getState().activeLayerPath, s.activeLayer?.uid))
          return

        x.commit({
          activeLayerPath: s.activeLayer?.uid ?? null,
          activeObjectId: null,
          activeObjectPointIndices: [],
        })
      })

      session.on('renderSettingChanged', (s) => {
        const { currentDocument, renderStrategy } = x.getState()
        if (!currentDocument || !renderStrategy) return

        engine.render(
          currentDocument as unknown as SilkDOM.Document,
          renderStrategy
        )
      })

      x.commit((d) => {
        d.engine = engine
        d.session = session
        d.renderStrategy = strategy as RenderStrategies.DifferenceRender

        session.document ??= d.currentDocument
      })
    },
    restorePreferences(x) {
      x.commit((d) => {
        d.currentTheme = LocalStorage.get('theme', 'light')
      })
    },
    async setDocument(x, document: SilkDOM.Document | null) {
      document?.on('layersChanged', () => {
        x.commit({})
      })

      x.commit({ currentDocument: document, currentFileHandler: null })

      x.commit((d) => {
        if (!d.session) return

        d.session!.setDocument(document)
        // TODO
        d.activeLayerPath = [document?.activeLayerId!] ?? null

        if (document && d.renderStrategy)
          d.engine?.render(document, d.renderStrategy)
      })
    },
    setCurrentFileHandler: (x, handler: FileSystemFileHandle) => {
      x.commit({ currentFileHandler: handler })
    },
    setRenderSetting: (x, setting: Partial<Silk3.RenderSetting>) => {
      if (!x.state.engine || !x.state.session) return

      x.commit((d) => {
        d.session?.setRenderSetting(setting)
      })

      x.executeOperation(EditorOps.rerenderCanvas)
    },
    setTool: (x, tool: Tool) => {
      if (
        EditorSelector.activeLayer(x.getStore)?.layerType !== 'vector' &&
        any(tool).in('shape-pen', 'point-cursor')
      ) {
        return
      }

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
        x.state.currentDocument as unknown as SilkDOM.Document,
        x.state.renderStrategy
      )
    },
    async autoSave(x, documentUid: string) {
      if (!x.state.engine) return
      if (x.state.currentDocument?.uid !== documentUid) return

      const document = x.state
        .currentDocument as unknown as SilkDOM.Document | null
      if (!document) return

      const buffer = SilkSerializer.exportDocument(
        document as unknown as SilkDOM.Document
      ).buffer

      autoSaveWorker?.postMessage({ buffer }, [buffer])
    },
    async createSession(x, document: SilkDOM.Document) {
      const session = await SilkSession.create()
      const renderStrategy = new RenderStrategies.DifferenceRender()

      session.setDocument(document)
      session.setBrushSetting({ color: { r: 0.3, g: 0.3, b: 0.3 } })
      session.setRenderStrategy(renderStrategy)

      x.commit((d) => {
        const sid = nanoid()

        d.session = session
        d.sessions[sid] = {
          sid,
          session,
          canvasPosition: { x: 0, y: 0 },
          canvasScale: 1,
          currentFileHandler: null,
          renderStrategy,
        }

        d.activeSessionId = sid
      })
    },
    // #endregion Engine & Session

    // #region UI
    setTheme: (x, theme: 'dark' | 'light') => {
      LocalStorage.set('theme', theme)
      x.commit({ currentTheme: theme })
    },
    setEditorMode: ({ state }, mode: EditorMode) => {},
    setEditorPage: (x, page: EditorPage) => {
      x.commit({ editorPage: page })
    },
    setCanvasTransform(
      x,
      next: Partial<{
        scale: number | ((current: number) => number)
        pos:
          | State['canvasPosition']
          | ((current: State['canvasPosition']) => State['canvasPosition'])
      }>
    ) {
      x.commit((d) => {
        if (next.scale != null) {
          d.canvasScale =
            typeof next.scale === 'function'
              ? next.scale(d.canvasScale)
              : next.scale
        }

        if (next.pos != null) {
          d.canvasPosition =
            typeof next.pos === 'function'
              ? next.pos(d.canvasPosition)
              : next.pos
        }
      })
    },
    // #endregion

    // #region Paint tools and Tool session
    setFill: (x, fill: SilkValue.FillSetting | null) => {
      x.commit({ currentFill: fill })
    },
    setStroke: (x, stroke: SilkValue.BrushSetting | null) => {
      x.commit({ currentStroke: stroke })
    },
    setBrushSetting(x, setting: Partial<BrushSetting>) {
      x.commit((draft) => {
        draft.session!.setBrushSetting(setting)
      })
    },

    setAndUpdateVectorStroke: (x, stroke: Partial<BrushSetting> | null) => {
      const activeLayerPath = x.state.activeLayerPath
      const activeObject = EditorSelector.activeObject(x.getStore)

      if (activeLayerPath && activeObject && x.state.session) {
        x.state.session.runCommand(
          new SilkCommands.VectorLayer.PatchObjectAttr({
            pathToTargetLayer: activeLayerPath,
            objectUid: activeObject.uid,
            patch: { brush: Object.assign({}, activeObject.brush, stroke) },
          })
        )
      }

      // x.commit({ vectorStroking })
    },

    setActiveLayer: (x, path: string[], objectUid?: string) => {
      if (shallowEquals(path, [x.state.session?.activeLayerId])) return

      x.commit((draft) => {
        draft.session?.setActiveLayer(path)

        draft.activeLayerPath = path
        draft.activeObjectId = objectUid ?? null
        draft.activeObjectPointIndices = []
        draft.selectedFilterIds = {}
      })
    },
    setActiveObject: (
      x,
      objectId: string | null,
      layerPath: string[] | null = null
    ) => {
      x.commit((d) => {
        if (d.activeObjectId !== objectId) {
          d.activeObjectPointIndices = []
        }

        if (layerPath != null) {
          d.session?.setActiveLayer(layerPath)
          d.activeLayerPath = layerPath
        }

        d.activeObjectId = objectId

        trace('activeObject changed', { objectId })
      })
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
    runCommand: async (x, cmd: SilkCommands.AnyCommandType) => {
      await x.state.session?.runCommand(cmd)

      cmd.effectedLayers.forEach((path) =>
        x.state.renderStrategy?.markUpdatedLayerId(path.slice(-1)[0])
      )

      await x.executeOperation(EditorOps.rerenderCanvas)
    },
    undoCommand: async (x) => {
      const cmd = await x.state.session?.undo()

      cmd?.effectedLayers.forEach((p) =>
        x.state.renderStrategy?.markUpdatedLayerId(p.slice(-1)[0])
      )

      await x.executeOperation(EditorOps.rerenderCanvas)
    },
    redoCommand: async (x) => {
      const cmd = await x.state.session?.redo()

      cmd?.effectedLayers.forEach((p) =>
        x.state.renderStrategy?.markUpdatedLayerId(p.slice(-1)[0])
      )

      await x.executeOperation(EditorOps.rerenderCanvas)
    },
    updateDocument: (
      x,
      proc: (document: SilkDOM.Document) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      if (!x.state.currentDocument) return

      x.commit((draft) => proc(draft.currentDocument as SilkDOM.Document))

      !skipRerender && x.executeOperation(EditorOps.rerenderCanvas)
    },
    updateLayer: (
      x,
      pathToLayer: string[] | null | undefined,
      proc: (layer: SilkDOM.LayerTypes) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      x.commit((d) => {
        if (!d.currentDocument || !pathToLayer) return
        const layer = SilkDOMDigger.findLayer(d.currentDocument, pathToLayer)

        layer?.update(proc)
        x.state.renderStrategy!.markUpdatedLayerId(pathToLayer.slice(-1)[0])
      })

      !skipRerender && x.executeOperation(EditorOps.rerenderCanvas)
    },
    updateRasterLayer: (
      x,
      layerId: string | null | undefined,
      proc: (layer: SilkDOM.RasterLayer) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      if (!x.state.currentDocument) return

      x.commit((d) => {
        const layer = findLayer(
          x.state.currentDocument as unknown as SilkDOM.Document,
          layerId
        )
        if (layer?.layerType !== 'raster') return

        layer.update(proc)
        layerId && d.renderStrategy!.markUpdatedLayerId(layerId)
      })

      !skipRerender && x.executeOperation(EditorOps.rerenderCanvas)
    },
    updateVectorLayer: (
      x,
      pathToLayer: string[] | null | undefined,
      proc: (layer: SilkDOM.VectorLayer) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      if (!pathToLayer) return

      x.commit((d) => {
        SilkDOMDigger.findLayer(d.currentDocument!, pathToLayer, {
          kind: 'vector',
        })?.update(proc)

        d.renderStrategy!.markUpdatedLayerId(pathToLayer.slice(-1)[0])
        d.vectorLastUpdated = Date.now()
      })

      !skipRerender && x.executeOperation(EditorOps.rerenderCanvas)
    },
    updateFilter: (
      x,
      layerId: string | null,
      filterId: string | null,
      proc: (filter: SilkDOM.Filter) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      x.commit((d) => {
        const layer = findLayer(d.session?.document, layerId)
        if (!layer) return

        const filter = layer.filters.find((filter) => filter.uid === filterId)
        if (!filter) return

        proc(filter)

        layerId && d.renderStrategy!.markUpdatedLayerId(layerId)
      })

      !skipRerender && x.executeOperation(EditorOps.rerenderCanvas)
    },
    updateActiveObject: (
      x,
      proc: (object: SilkDOM.VectorObject) => void,
      { skipRerender = false }: { skipRerender?: boolean } = {}
    ) => {
      x.commit((d) => {
        if (!d.session) return
        if (d.session.activeLayer?.layerType !== 'vector') return

        const layerId = d.session?.activeLayerId
        layerId && d.renderStrategy!.markUpdatedLayerId(layerId)

        const { activeLayer } = d.session
        const object = activeLayer.objects.find(
          (obj) => obj.uid === d.activeObjectId
        )

        object?.update(proc)
      })

      !skipRerender && x.executeOperation(EditorOps.rerenderCanvas)
    },
    addLayer: (
      x,
      newLayer: SilkDOM.LayerTypes,
      { aboveLayerId }: { aboveLayerId?: string | null }
    ) => {
      x.commit((d) => {
        d.session!.document?.addLayer(newLayer, { aboveLayerId })
        d.session!.setActiveLayer([newLayer.uid])
        d.engine!.render(d.currentDocument!, d.session?.renderStrategy!)

        d.renderStrategy?.markUpdatedLayerId(newLayer.uid)
      })
    },
    moveLayer(x, pathToParent: string[], oldIndex: number, newIndex: number) {
      x.commit((d) =>
        d.currentDocument?.sortLayer((layers) => {
          if (pathToParent.length === 0) {
            return arrayMove(layers, oldIndex, newIndex)
          }

          const parent = SilkDOMDigger.findLayer({ layers }, pathToParent, {
            kind: 'group',
          })!

          console.log(pathToParent, parent.layers, oldIndex, newIndex)

          parent.update((l) => {
            arrayMove(l.layers, oldIndex, newIndex)
          })

          return layers
        })
      )
    },
    addPoint: (
      x,
      objectOrId: SilkDOM.VectorObject | string,
      segmentIndex: number,
      point: SilkDOM.Path.PathPoint
    ) => {
      x.commit((d) => {
        if (!d.engine || d.session?.activeLayer?.layerType !== 'vector') return

        const { activeLayer } = d.session
        const object =
          typeof objectOrId === 'string'
            ? activeLayer?.objects.find((obj) => obj.uid === d.activeObjectId)
            : objectOrId
        if (!object) throw new Error(`Object(id: ${objectOrId}) not found`)
        object.path.points.splice(segmentIndex, 0, point)

        d.renderStrategy?.markUpdatedLayerId(d.session.activeLayerId!)
      })

      x.executeOperation(EditorOps.rerenderCanvas)
    },
    deleteLayer: (x, layerPath: string[] | null | undefined) => {
      if (!layerPath) return

      x.commit((d) => {
        if (!d.session?.document) return

        const { document } = d.session
        if (document.layers.length === 1) return

        const targetUid = layerPath.slice(-1)[0]
        const parent = SilkDOMDigger.findLayerParent(document, layerPath)
        const idx = parent.layers.findIndex((l) => l.uid === targetUid)

        parent.update((l) => {
          l.layers.splice(idx, 1)
        })

        // ActiveLayerがなくなると画面がアになるので……
        // TODO
        // const nextActiveLayer =
        //   document.layers[idx - 1] ?? document.layers.slice(-1)
        // if (layerPath === d.activeLayerId) {
        //   d.session.activeLayerId = nextActiveLayer.uid
        //   d.activeLayerId = nextActiveLayer.uid
        // }
      })

      x.executeOperation(EditorOps.rerenderCanvas)
    },
    deleteSelectedFilters: (x) => {
      x.commit((d) => {
        if (!d.activeLayerPath) return

        SilkDOMDigger.findLayer(d.currentDocument!, d.activeLayerPath)?.update(
          (layer) => {
            for (const filterId of Object.keys(d.selectedFilterIds)) {
              const idx = layer.filters.findIndex((f) => f.uid === filterId)
              if (idx === -1) continue
              layer.filters.splice(idx, 1)
            }
          }
        )
      })

      x.executeOperation(EditorOps.rerenderCanvas)
    },
    deleteSelectedObjectPoints: async (x) => {
      if (
        !x.state.activeLayerPath ||
        !x.state.activeObjectId ||
        x.state.session?.activeLayer?.layerType !== 'vector'
      )
        return

      await x.state.session?.runCommand(
        new SilkCommands.VectorLayer.RemovePathPoint({
          pathToTargetLayer: x.state.activeLayerPath,
          pointIndices: x.state.activeObjectPointIndices,
          objectUid: x.state.activeObjectId,
        })
      )

      x.commit({ activeObjectPointIndices: [] })
      x.executeOperation(EditorOps.rerenderCanvas)
    },
    // #endregion
  },
})

export const EditorSelector = {
  defaultVectorBrush: selector(
    (): SilkSession.BrushSetting => ({
      brushId: '@silk-paint/brush',
      color: { r: 26, g: 26, b: 26 },
      opacity: 1,
      size: 1,
    })
  ),

  thumbnailUrlOfLayer: selector((get) => {
    const { renderStrategy } = get(EditorStore)
    return (layerId: string) => renderStrategy?.getPreiewForLayer(layerId)
  }),

  // #region UI
  activeSession: selector((get) => {
    // const { activeSessionId, sessions } = get(EditorStore)
    // if (!activeSessionId) return null
    // return sessions[activeSessionId]
    return get(EditorStore).session
  }),
  canvasScale: selector((get) => {
    // const { activeSessionId, sessions } = get(EditorStore)
    // if (!activeSessionId) return 1
    // return sessions[activeSessionId].canvasScale ?? 1
    return get(EditorStore).canvasScale
  }),
  canvasPosition: selector((get) => {
    // const { activeSessionId, sessions } = get(EditorStore)
    // if (!activeSessionId) return { x: 0, y: 0 }
    // return sessions[activeSessionId].canvasPosition ?? { x: 0, y: 0 }
    return get(EditorStore).canvasPosition
  }),
  // #endregon

  // #region Document
  layers: selector((get) => get(EditorStore).currentDocument?.layers ?? []),
  // #endregion

  // #region Session proxies
  currentBrushSetting: selector(
    (get) => get(EditorStore).session?.brushSetting ?? null
  ),
  currentVectorBrush: selector((get) => {
    const { session, activeObjectId } = get(EditorStore)

    if (session?.activeLayer?.layerType !== 'vector')
      return session?.brushSetting

    const object = session?.activeLayer?.objects.find(
      (obj) => obj.uid === activeObjectId
    )

    if (!object) return session?.brushSetting ?? null
    return object.brush
  }),
  currentVectorFill: selector((get): SilkValue.FillSetting => {
    const defaultFill: SilkValue.FillSetting = {
      type: 'fill',
      color: { r: 0.2, g: 0.2, b: 0.2 },
      opacity: 1,
    }

    const { session, currentFill, activeObjectId } = get(EditorStore)
    if (session?.activeLayer?.layerType !== 'vector')
      return currentFill ?? defaultFill

    const object = session?.activeLayer?.objects.find(
      (obj) => obj.uid === activeObjectId
    )

    if (object?.fill) return object.fill
    return currentFill ?? defaultFill
  }),

  currentSession: selector((get) => get(EditorStore).session),
  currentDocument: selector((get) => get(EditorStore).session?.document),
  activeLayer: selector((get) => get(EditorStore).session?.activeLayer),
  activeLayerPath: selector((get) => get(EditorStore).activeLayerPath),
  activeObject: selector((get): SilkDOM.VectorObject | null => {
    const { session, activeObjectId } = get(EditorStore)

    if (session?.activeLayer?.layerType !== 'vector') return null
    return session?.activeLayer?.objects.find(
      (obj) => obj.uid === activeObjectId
    ) as any
  }),
  activeLayerBBox: selector(
    (get) => get(EditorStore).session?.currentLayerBBox
  ),
  // #endregion

  // #region Engine proxies
  getAvailableFilters: selector(
    (get) => get(EditorStore).engine?.toolRegistry.registeredFilters ?? []
  ),
  getFilterInstance: selector((get, id) =>
    get(EditorStore).engine?.toolRegistry.getFilterInstance(id)
  ),
  // #endregion
}

const findLayer = (
  document: SilkDOM.Document | null | undefined,
  layerId: string | null | undefined
) => {
  if (document == null || layerId === null) return

  const index = findLayerIndex(document, layerId)
  return document.layers[index]
}

const findLayerIndex = (
  document: SilkDOM.Document | null | undefined,
  layerId: string | null | undefined
) => {
  if (document == null || layerId === null) return -1

  const index = document.layers.findIndex((layer) => layer.uid === layerId)

  if (index === -1) {
    warn('Layer not found:', layerId)
  }

  return index
}

// const debouned = debounce((f: () => void) => {
//   f()
// }, 100)

console.log(debouncing((x: any) => {}) as any)
