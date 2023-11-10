import { PaneUIImpls } from '@/components/FilterPane'
import {
  Brushes,
  Document,
  ExtraBrushes,
  Filters,
  Inks,
  Paplico,
} from '@paplico/core-new'
import { PplcEditorHandle } from '@paplico/editor'
import {
  RefObject,
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import { createStore } from 'zustand/vanilla'
import { PaplicoChatWebSocketBackend, paplicoChat } from '@paplico/chat/client'
import { useDangerouslyEffectAsync } from '@/utils/hooks'
import { useUpdate } from 'react-use'
import { useNotifyStore } from './notifications'
import { createUseStore, storePicker } from '@/utils/zustand'
import { changedKeys, shallowEquals } from '@paplico/shared-lib'
import { getLine } from '@/utils/string'

interface EngineStore {
  _engine: Paplico | null
  canvasEditor: PplcEditorHandle | null

  engineState: Paplico.State | null
  strokeTarget: Paplico.StrokingTarget | null

  initialize(engine: Paplico): void
  _setEditorHandle: (handle: PplcEditorHandle | null) => void
  _setEngineState: (state: Paplico.State) => void
  _setStrokingTarget: (vis: Paplico.StrokingTarget | null) => void
}

export const DEFAULT_BRUSH_ID = Brushes.CircleBrush.metadata.id
export const DEFAULT_BRUSH_VERSION = '0.0.1'

const engineStore = createStore<EngineStore>((set, get) => ({
  _engine: null,
  engineState: null,
  strokeTarget: null,
  canvasEditor: null,

  initialize: (engine: Paplico) => {
    set({ _engine: engine })
  },

  _setEditorHandle: (handle) => {
    ;(window as any).pplceditor = handle
    set({ canvasEditor: handle })
  },
  _setEngineState: (state) => set({ engineState: state }),
  _setStrokingTarget: (layer) => set({ strokeTarget: layer }),
}))

export const initializeOnlyUseEngineStore = createUseStore(engineStore)

export function usePaplicoInit(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { chatMode }: { chatMode?: boolean },
) {
  const papRef = useRef<Paplico | null>(null)
  const rerender = useUpdate()
  const engineStore = initializeOnlyUseEngineStore(
    // If not pick at here, engine state updates causes rerendering on app root
    storePicker([
      '_setEngineState',
      '_setStrokingTarget',
      'initialize',
      'canvasEditor',
    ]),
  )
  const notifyStore = useNotifyStore()

  useDangerouslyEffectAsync(async () => {
    const pplc = new Paplico(canvasRef.current!, {
      paneComponentImpls: PaneUIImpls,
      paneCreateElement: createElement,
      // colorSpace: 'display-p3',
    })

    ;(window as any).pplc = pplc
    pplc.exposeLogChannelToGlobalThis()

    await pplc.brushes.register(ExtraBrushes.ScatterBrush)
    await pplc.fonts.requestToRegisterLocalFonts()

    pplc.on('stateChanged', () => {
      engineStore._setEngineState(pplc.state)
      rerender()
    })

    pplc.on('document:layerUpdated', ({ layerEntityUid }) => {
      // if (!current) {
      //   engineStore._setActiveLayerEntity(null)
      //   return
      // }
      // const vis = pap.currentDocument!.getVisuByUid(current.layerUid)
      // engineStore._setActiveLayerEntity(vis!)
    })

    pplc.on('documentChanged', () => {
      engineStore._setStrokingTarget(null)
    })

    pplc.on('document:undo', () => {
      notifyStore.emit({ type: 'undo' })
    })
    pplc.on('document:redo', () => {
      notifyStore.emit({ type: 'redo' })
    })

    pplc.on('strokingTargetChanged', ({ current }) => {
      engineStore._setStrokingTarget(current)
    })

    if (!chatMode) {
      createTestDocument(pplc)
    }

    papRef.current = pplc
    rerender()
    engineStore.initialize(pplc)

    return () => {
      pplc.dispose()
    }
  }, [])

  // Canvas editor event
  useDangerouslyEffectAsync(() => {
    const handler = engineStore.canvasEditor
    if (!handler) return

    const offs = [
      handler.on('toolModeChanged', ({ next }) => {
        notifyStore.emit({ type: 'toolChanged', tool: next })
      }),
    ]

    return () => {
      offs.forEach((off) => off())
    }
  }, [engineStore.canvasEditor])

  usePaplicoChat(papRef, !!chatMode)
}

export function usePaplicoInstance() {
  const store = initializeOnlyUseEngineStore(
    storePicker(['_engine', 'canvasEditor']),
  )

  const update = useUpdate()

  useEffect(() => {
    store._engine?.on('stateChanged', () => {
      update()
    })
  })

  return useMemo(
    () => ({
      pplc: store._engine,
      canvasEditor: store.canvasEditor,
    }),
    [store, store._engine, store.canvasEditor],
  )
}

export type UseCanvasEditor = {
  <U>(selector: (state: PplcEditorHandle) => U): U | Record<string, null>
}

export const useCanvasEditorState: UseCanvasEditor = <T>(
  selector: (state: PplcEditorHandle) => T,
) => {
  const { canvasEditor } = usePaplicoInstance()

  const mountedStack = useMemo(() => new Error().stack, [])
  const selectorRef = useRef(selector)
  selectorRef.current = selector

  const prevRef = useRef<T | Record<string, null> | null>()

  const onChangeCallback = useCallback(
    (onChange: () => void) => {
      console.log('start subscribe')
      return canvasEditor?.subscribeEditorState(onChange) ?? (() => {})
    },
    [canvasEditor],
  )

  return useSyncExternalStore(onChangeCallback, () => {
    if (!canvasEditor) {
      return (prevRef.current ??= {} as Record<string, null>)
    }

    const next = selectorRef.current(canvasEditor)

    if (prevRef.current && shallowEquals(next, prevRef.current)) {
      return prevRef.current
    }

    // if (prevRef.current && next) {
    //   console.groupCollapsed('changed', changedKeys(prevRef.current, next))
    //   console.log(getLine(mountedStack!, 1, Infinity))
    //   console.groupEnd()
    // }

    prevRef.current = next
    return next
  })
}

function usePaplicoChat(papRef: RefObject<Paplico | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    if (!papRef.current) {
      console.info('Chat: Waiting for initialize paplico')
      return
    }

    const chat = paplicoChat(papRef.current, {
      backend: new PaplicoChatWebSocketBackend({
        wsUrl: 'ws://localhost:41234/pap-chat',
      }),
    })

    chat.joinRoom('__TEST__')

    return () => {
      chat.dispose()
    }
  }, [papRef.current])
}

/// TEST DOCUMENT
function createTestDocument(pplc: Paplico) {
  const doc = Document.visu.createDocument({ width: 1000, height: 1400 })

  const raster = Document.visu.createCanvasVisually({
    width: 1000,
    height: 1400,
    // compositeMode: 'multiply',
  })

  // const vector = Document.visu.createVectorObjectVisually({
  //   objec
  //   filters: [
  //     Document.visu.createVisuallyFilter({
  //       enabled: false,
  //       opacity: 1,
  //       filterId: Filters.TestFilter.metadata.id,
  //       filterVersion: Filters.TestFilter.metadata.version,
  //       settings: Filters.TestFilter.getInitialSetting(),
  //     }),
  //   ],
  // })

  const rasterGroupVis = Document.visu.createGroupVisually({})
  const vectorGroupVis = Document.visu.createGroupVisually({})
  // const vectorGroupNode = Document.visu.createLayerNode(vectorGroupVis)

  const vector = Document.visu.createVectorObjectVisually({
    path: Document.visu.createVectorPath({
      points: [
        { isMoveTo: true, x: 0, y: 0 },
        { x: 1000, y: 1000, begin: null, end: null },
      ],
    }),
    filters: [
      Document.visu.createVisuallyFilter('stroke', {
        stroke: {
          brushId: ExtraBrushes.ScatterBrush.metadata.id,
          brushVersion: '0.0.1',
          color: { r: 1, g: 1, b: 0 },
          opacity: 1,
          size: 30,
          settings: {
            texture: 'pencil',
            noiseInfluence: 1,
            inOutInfluence: 0,
            inOutLength: 0,
          } satisfies ExtraBrushes.ScatterBrush.Settings,
        },
        ink: {
          inkId: Inks.TextureReadInk.metadata.id,
          inkVersion: Inks.TextureReadInk.metadata.version,
          setting: {} satisfies Inks.TextureReadInk.Setting,
        },
      }),
      Document.visu.createVisuallyFilter('postprocess', {
        processor: {
          enabled: true,
          opacity: 1,
          filterId: Filters.TestFilter.metadata.id,
          filterVersion: Filters.TestFilter.metadata.version,
          settings: Filters.TestFilter.getInitialSetting(),
        },
      }),
    ],
  })

  const text = Document.visu.createTextVisually({
    transform: {
      position: { x: 16, y: 16 },
      scale: { x: 1, y: 1 },
      rotate: 0,
    },
    fontFamily: 'Poppins',
    fontStyle: 'Bold',
    fontSize: 64,
    textNodes: [
      { text: 'PAPLIC-o-\n', position: { x: 0, y: 0 } },
      {
        text: 'MAGIC',
        fontSize: 128,
        position: { x: 0, y: 0 },
        // color: { r: 0, g: 0.5, b: 0.5, a: 1 },
      },
    ],
  })

  // doc.addLayer(
  //   Document.createVectorLayerEntity({
  //     objects: [
  //       Document.createVectorObject({
  //         path: Document.createVectorPath({
  //           points: [
  //             { isMoveTo: true, x: 0, y: 0, begin: null, end: null },
  //             { x: 1000, y: 0, begin: null, end: null },
  //             { x: 1000, y: 1000, begin: null, end: null },
  //             { x: 0, y: 1000, begin: null, end: null },
  //             { isClose: true, x: 0, y: 0, begin: null, end: null },
  //           ],
  //           closed: true,
  //         }),
  //         filters: [
  //           // Document.createVectorAppearance({
  //           //   kind: 'fill',
  //           //   fill: {
  //           //     type: 'fill',
  //           //     color: { r: 0, g: 0, b: 1 },
  //           //     opacity: 1,
  //           //   },
  //           // }),
  //         ],
  //       }),
  //     ],
  //   }),
  // )

  doc.layerNodes.addLayerNode(rasterGroupVis)
  doc.layerNodes.addLayerNode(vectorGroupVis)

  doc.layerNodes.addLayerNode(raster, [rasterGroupVis.uid])
  doc.layerNodes.addLayerNode(vector, [vectorGroupVis.uid])
  doc.layerNodes.addLayerNode(text, [vectorGroupVis.uid])

  pplc.loadDocument(doc)
  // pap.setStrokingTargetLayer([raster.uid])

  pplc!.setStrokingTarget([vectorGroupVis.uid])
  pplc!.rerender()

  pplc.setBrushSetting({
    brushId: ExtraBrushes.ScatterBrush.metadata.id,
    brushVersion: '0.0.1',
    color: { r: 0, g: 0, b: 0 },
    opacity: 0.4,
    size: 2,
    settings: {
      texture: 'pencil',
      noiseInfluence: 1,
      scatterRange: 0,
      randomScale: 10,
      randomRotation: 1,
      inOutInfluence: 1,
      inOutLength: 0.2,
    } satisfies ExtraBrushes.ScatterBrush.Settings,
  })
}
