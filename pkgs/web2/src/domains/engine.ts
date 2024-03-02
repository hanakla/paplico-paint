import { PaneUIImpls } from '@/components/FilterPane'
import {
  Brushes,
  Commands,
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
import { shallowEquals } from '@paplico/shared-lib'
import debounce from 'just-debounce'
import { rescue } from '@hanakla/arma'

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

    console.log(pplc)
    ;(window as any).pplc = pplc
    pplc.exposeLogChannelToGlobalThis()

    await pplc.brushes.register(ExtraBrushes.ScatterBrush)
    await rescue(() => pplc.fonts.requestToRegisterLocalFonts())

    pplc.on('stateChanged', () => {
      engineStore._setEngineState(pplc.state)
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
    const canvasEditor = engineStore.canvasEditor
    if (!canvasEditor) return

    const offs = [
      canvasEditor.on('toolModeChanged', ({ next }) => {
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

export function useCommandGrouper({
  threshold = 500,
}: {
  threshold?: number
} = {}) {
  const rerender = useUpdate()
  const { pplc } = usePaplicoInstance()

  const ref = useRef<Commands.CommandGroup | null>(null)
  const debouncedCommit = useMemo(
    () =>
      debounce(() => {
        ref.current = null
      }, threshold),
    [threshold],
  )

  return useMemo(
    () => ({
      get isStarted() {
        return !!ref.current
      },
      autoStartAndDoAdd: (command: Commands.AnyCommand) => {
        if (!ref.current) {
          ref.current = new Commands.CommandGroup([])
          pplc?.command.do(ref.current)
          // execute(EditorOps.runCommand, ref.current)
        }

        ref.current.doAndAddCommand(command)
        pplc?.requestPreviewPriolityRerender()
        rerender()
      },
      cancel: () => {
        if (!ref.current) return
        if (pplc?.command.getUndoStack()?.at(-1) !== ref.current) return

        pplc?.command.undo()
        ref.current = null
      },
      commit: () => {
        ref.current = null
      },
      debouncedCommit,
    }),
    [debouncedCommit],
  )
}

/// TEST DOCUMENT
function createTestDocument(pplc: Paplico) {
  const docSize = { width: 1000, height: 1400 }
  const doc = Document.visu.createDocument({
    width: docSize.width,
    height: docSize.height,
  })

  const group = Document.visu.createGroupVisually({})
  group.transform.translate = {
    x: 100,
    y: 100,
  }
  // doc.layerNodes.addLayerNode(group)

  // doc.layerNodes.addLayerNode(
  //   Document.visu.createVectorObjectVisually({
  //     transform: {
  //       ...Document.visu.DEFAULT_VISU_TRANSFORM(),
  //       translate: { x: 10, y: 10 },
  //       scale: { x: 1.1, y: 1.1 },
  //     },
  //     filters: [
  //       Document.visu.createVisuallyFilter('stroke', {
  //         stroke: {
  //           brushId: Brushes.CircleBrush.metadata.id,
  //           brushVersion: Brushes.CircleBrush.metadata.version,
  //           color: { r: 0, g: 0, b: 0 },
  //           opacity: 1,
  //           size: 20,
  //           settings: {
  //             lineCap: 'round',
  //           } satisfies Brushes.CircleBrush.Settings,
  //         },
  //         ink: {
  //           inkId: Inks.PlainInk.metadata.id,
  //           inkVersion: Inks.PlainInk.metadata.version,
  //           settings: {} satisfies Inks.PlainInk.Setting,
  //         },
  //       }),
  //     ],
  //     path: Document.visu.createVectorPath({
  //       points: [
  //         { isMoveTo: true, x: 0, y: 0 },
  //         { x: 100, y: 100, begin: null, end: null },
  //       ],
  //     }),
  //   }),
  //   [group.uid],
  // )

  // pplc.loadDocument(doc)

  // pplc.rerender()
  // // requestAnimationFrame(function anim() {
  // //   pplc!.rerender()
  // //   requestAnimationFrame(anim)
  // // })

  // pplc.setBrushSetting({
  //   brushId: ExtraBrushes.ScatterBrush.metadata.id,
  //   brushVersion: '0.0.1',
  //   color: { r: 0, g: 0, b: 0 },
  //   opacity: 0.4,
  //   size: 2,
  //   settings: {
  //     texture: 'pencil',
  //     noiseInfluence: 1,
  //     scatterRange: 0,
  //     randomScale: 10,
  //     randomRotation: 1,
  //     inOutInfluence: 1,
  //     inOutLength: 0.2,
  //   } satisfies ExtraBrushes.ScatterBrush.Settings,
  // })

  // pplc.setInkSetting({
  //   inkId: Inks.RainbowInk.metadata.id,
  //   inkVersion: Inks.RainbowInk.metadata.version,
  //   settings: {} satisfies Inks.RainbowInk.Setting,
  // })

  // return doc

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

  const bgGroup = Document.visu.createGroupVisually({})
  const vectorGroupVis = Document.visu.createGroupVisually({})

  const fgElements = [
    Document.visu.createCanvasVisually({
      width: docSize.width * 2,
      height: docSize.height * 2,
      // compositeMode: 'multiply',
      transform: {
        translate: { x: 0, y: 0 },
        scale: { x: 0.5, y: 0.5 },
        rotate: 0,
      },
    }),

    Document.visu.createVectorObjectVisually({
      blendMode: 'screen',
      path: Document.visu.createVectorPath({
        points: [
          { isMoveTo: true, x: 0, y: 0 },
          { x: 1000, y: 1000, begin: null, end: null },
        ],
      }),
      filters: [
        Document.visu.createVisuallyFilter('stroke', {
          stroke: {
            brushId: Brushes.CircleBrush.metadata.id,
            brushVersion: '0.0.1',
            color: { r: 1, g: 1, b: 0 },
            opacity: 1,
            size: 400,
            settings: {
              lineCap: 'round',
            } satisfies Brushes.CircleBrush.Settings,
            // settings: {
            //   texture: 'pencil',
            //   noiseInfluence: 1,
            //   inOutInfluence: 0,
            //   inOutLength: 0,
            //   scatterRange: 100,
            //   randomScale: 0.1,
            //   rotationAdjust: 1,
            //   pressureInfluence: 1,
            //   randomRotation: 1,
            // } satisfies ExtraBrushes.ScatterBrush.Settings,
          },
          ink: {
            inkId: Inks.RainbowInk.metadata.id,
            inkVersion: Inks.RainbowInk.metadata.version,
            settings: {} satisfies Inks.RainbowInk.Setting,
          },
        }),
        Document.visu.createVisuallyFilter('postprocess', {
          enabled: true,
          processor: {
            opacity: 1,
            filterId: Filters.ChromaticAberration.metadata.id,
            filterVersion: Filters.ChromaticAberration.metadata.version,
            settings: Filters.ChromaticAberration.getInitialSetting(),
          },
        }),
      ],
    }),

    Document.visu.createTextVisually({
      blendMode: 'multiply',
      opacity: 0.8,
      transform: {
        translate: { x: 32, y: -16 },
        scale: { x: 1, y: 1 },
        rotate: 0,
      },
      fontFamily: 'Poppins',
      fontStyle: 'Bold',
      fontSize: 72,
      textNodes: [
        { text: 'PAPLIC-o-\n', translate: { x: 0, y: 0 } },
        {
          text: 'MAGIC',
          fontSize: 128,
          translate: { x: 0, y: 0 },
          color: { r: 0, g: 0.5, b: 0.5, a: 1 },
        },
      ],
    }),
    Document.visu.createVectorObjectVisually({
      path: Document.visu.createVectorPath({
        points: [
          {
            isMoveTo: true,
            x: 404,
            y: 357,
          },
          {
            x: 396,
            y: 357,
            begin: {
              x: 404,
              y: 354.4145122304413,
            },
            end: {
              x: 396.0363787628564,
              y: 356.98059799314325,
            },
            pressure: 0.29613694311943756,
            deltaTime: -693001036102.8928,
            tilt: {
              x: 0,
              y: 0,
            },
          },
          {
            x: 357,
            y: 387,
            begin: {
              x: 382.0498774029481,
              y: 364.4400653850944,
            },
            end: {
              x: 368.828454388089,
              y: 376.8143864991456,
            },
            pressure: 0,
            deltaTime: -1699672924221.8523,
            tilt: {
              x: 0,
              y: 0,
            },
          },
          {
            x: 284,
            y: 473,
            begin: {
              x: 328.71844886476595,
              y: 411.3535579220071,
            },
            end: {
              x: 303.105139027619,
              y: 440.6682262609525,
            },
            pressure: 0,
            deltaTime: -1699672924132.7625,
            tilt: {
              x: 0,
              y: 0,
            },
          },
          {
            x: 353,
            y: 717,
            begin: {
              x: 91.13312671687467,
              y: 741.9175657758385,
            },
            end: {
              x: 137.3516228277861,
              y: 815.6648152712368,
            },
            pressure: 0,
            deltaTime: -1699672923886.357,
            tilt: {
              x: 0,
              y: 0,
            },
          },
          {
            x: 493,
            y: 727,
            begin: {
              x: 390.839498565591,
              y: 746.492550352593,
            },
            end: {
              x: 457.19060246639174,
              y: 729.7128331464854,
            },
            pressure: 0,
            deltaTime: -1699672923704.7734,
            tilt: {
              x: 0,
              y: 0,
            },
          },
          {
            x: 543,
            y: 706,
            begin: {
              x: 511.0253442007076,
              y: 725.6344436211585,
            },
            end: {
              x: 526.8846260391998,
              y: 714.189780209587,
            },
            pressure: 0,
            deltaTime: -1699672923663.1804,
            tilt: {
              x: 0,
              y: 0,
            },
          },
          {
            x: 624,
            y: 620,
            begin: {
              x: 578.5133925655249,
              y: 687.9522103355529,
            },
            end: {
              x: 613.7789735252551,
              y: 660.8841058989796,
            },
            pressure: 0,
            deltaTime: -1699672923568.0007,
            tilt: {
              x: 0,
              y: 0,
            },
          },
          {
            x: 579,
            y: 500,
            begin: {
              x: 635.9010548450873,
              y: 572.3957806196511,
            },
            end: {
              x: 611.5328417664867,
              y: 532.5328417664867,
            },
            pressure: 0,
            deltaTime: -1699672923462.2395,
            tilt: {
              x: 0,
              y: 0,
            },
          },
          {
            x: 567,
            y: 489,
            begin: {
              x: 574.7751868950601,
              y: 495.77518689506,
            },
            end: {
              x: 570.4444967706995,
              y: 494.1667451560493,
            },
            pressure: 0,
            deltaTime: -1699672923450,
            tilt: {
              x: 0,
              y: 0,
            },
          },
        ],
      }),
      filters: [
        Document.visu.createVisuallyFilter('stroke', {
          stroke: {
            brushId: Brushes.CircleBrush.metadata.id,
            brushVersion: '0.0.1',
            color: { r: 1, g: 1, b: 1 },
            opacity: 1,
            size: 20,
            settings: {
              lineCap: 'round',
            } satisfies Brushes.CircleBrush.Settings,
          },
          ink: {
            inkId: Inks.RainbowInk.metadata.id,
            inkVersion: Inks.RainbowInk.metadata.version,
            settings: {} satisfies Inks.RainbowInk.Setting,
          },
        }),
      ],
    }),
  ]

  const bgElements = [
    Document.visu.createVectorObjectVisually({
      path: Document.visu.createVectorPath({
        points: [
          { isMoveTo: true, x: 0, y: 0 },
          { x: docSize.width, y: 0, begin: null, end: null },
          { x: docSize.width, y: docSize.height, begin: null, end: null },
          { x: 0, y: docSize.height, begin: null, end: null },
          { isClose: true },
        ],
      }),
      filters: [
        Document.visu.createVisuallyFilter('fill', {
          fill: {
            type: 'linear-gradient',
            start: { x: 0, y: 0 },
            end: { x: 1, y: 1 },
            colorStops: [
              { position: 0, color: { r: 0.2, g: 0.2, b: 0.8, a: 1 } },
              { position: 0.1, color: { r: 0.0, g: 0.0, b: 0.8, a: 1 } },
            ],
            opacity: 1,
          },
        }),
      ],
    }),
    Document.visu.createVectorObjectVisually({
      transform: {
        translate: { x: 32, y: docSize.height - 100 - 32 },
        scale: { x: 1, y: 1 },
        rotate: 0,
      },
      path: Document.visu.createVectorPath({
        points: [
          { isMoveTo: true, x: 78, y: 100 },
          { x: 0, y: 100, begin: null, end: null },
          { x: 0, y: 0, begin: null, end: null },
        ],
      }),
      filters: [
        Document.visu.createVisuallyFilter('stroke', {
          ink: {
            inkId: Inks.PlainInk.metadata.id,
            inkVersion: Inks.PlainInk.metadata.version,
            settings: {} satisfies Inks.PlainInk.Setting,
          },
          stroke: {
            brushId: Brushes.CircleBrush.metadata.id,
            brushVersion: Brushes.CircleBrush.metadata.version,
            color: { r: 1, g: 1, b: 1 },
            size: 2,
            opacity: 1,
            settings: {
              lineCap: 'round',
            } satisfies Brushes.CircleBrush.Settings,
          },
        }),
      ],
    }),
    Document.visu.createVectorObjectVisually({
      path: Document.visu.createVectorPath({
        points: [
          { isMoveTo: true, x: docSize.width - 100, y: 32 },
          { x: docSize.width - 32, y: 32, begin: null, end: null },
          { x: docSize.width - 32, y: 100 + 32, begin: null, end: null },
        ],
      }),
      filters: [
        Document.visu.createVisuallyFilter('stroke', {
          ink: {
            inkId: Inks.PlainInk.metadata.id,
            inkVersion: Inks.PlainInk.metadata.version,
            settings: {} satisfies Inks.PlainInk.Setting,
          },
          stroke: {
            brushId: Brushes.CircleBrush.metadata.id,
            brushVersion: Brushes.CircleBrush.metadata.version,
            color: { r: 1, g: 1, b: 1 },
            size: 2,
            opacity: 1,
            settings: {
              lineCap: 'round',
            } satisfies Brushes.CircleBrush.Settings,
          },
        }),
      ],
    }),
    Document.visu.createVectorObjectVisually({
      transform: {
        translate: {
          x: 56,
          y: docSize.height - 152 - 56,
        },
        scale: { x: 1, y: 1 },
        rotate: 0,
      },
      path: Document.visu.createVectorPath({
        points: [
          { isMoveTo: true, x: 0, y: 0 },
          { x: 128, y: 0, begin: null, end: null },
          { x: 128, y: 152, begin: null, end: null },
          { x: 0, y: 152, begin: null, end: null },
          { x: 0, y: 0, begin: null, end: null },
          { isClose: true },
        ],
      }),
      filters: [
        Document.visu.createVisuallyFilter('fill', {
          fill: {
            type: 'linear-gradient',
            start: { x: 0, y: -64 },
            end: { x: 0, y: 64 },
            colorStops: [
              { position: 0, color: { r: 1, g: 1, b: 1, a: 1 } },
              { position: 1, color: { r: 1, g: 1, b: 1, a: 0 } },
            ],
            opacity: 1,
          },
        }),
      ],
    }),
  ]

  doc.layerNodes.addLayerNode(bgGroup)
  bgElements.forEach((visu) => doc.layerNodes.addLayerNode(visu, [bgGroup.uid]))

  doc.layerNodes.addLayerNode(vectorGroupVis)
  fgElements.forEach((visu) =>
    doc.layerNodes.addLayerNode(visu, [vectorGroupVis.uid]),
  )

  pplc.loadDocument(doc)
  // pap.setStrokingTargetLayer([raster.uid])

  pplc!.setStrokingTarget([vectorGroupVis.uid])
  pplc.rerender()
  // requestAnimationFrame(function anim() {
  //   pplc!.rerender()
  //   requestAnimationFrame(anim)
  // })

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

  pplc.setInkSetting({
    inkId: Inks.RainbowInk.metadata.id,
    inkVersion: Inks.RainbowInk.metadata.version,
    settings: {} satisfies Inks.RainbowInk.Setting,
  })

  console.log('hi')
}
