import { PaneUIImpls } from '@/components/FilterPane'
import {
  Brushes,
  Document,
  ExtraBrushes,
  Inks,
  Paplico,
} from '@paplico/core-new'
import { PapEditorHandle } from '@paplico/editor'
import { RefObject, createElement, useEffect, useMemo, useRef } from 'react'
import { createStore } from 'zustand/vanilla'
import { PaplicoChatWebSocketBackend, paplicoChat } from '@paplico/chat/client'
import { useDangerouslyEffectAsync } from '@/utils/hooks'
import { useUpdate } from 'react-use'
import { useNotifyStore } from './notifications'
import { createUseStore } from '@/utils/zustand'

interface EngineStore {
  _engine: Paplico | null
  canvasEditor: PapEditorHandle | null

  engineState: Paplico.State | null
  strokeTargetVisu: Document.VisuElement.AnyElement | null

  initialize(engine: Paplico): void
  _setEditorHandle: (handle: PapEditorHandle | null) => void
  _setEngineState: (state: Paplico.State) => void
  _setActiveLayerEntity: (vis: Document.VisuElement.AnyElement | null) => void
}

export const DEFAULT_BRUSH_ID = Brushes.CircleBrush.metadata.id
export const DEFAULT_BRUSH_VERSION = '0.0.1'

const engineStore = createStore<EngineStore>((set, get) => ({
  _engine: null,
  engineState: null,
  strokeTargetVisu: null,
  canvasEditor: null,

  initialize: (engine: Paplico) => {
    set({ _engine: engine })
  },

  _setEditorHandle: (handle) => {
    set({ canvasEditor: handle })
  },
  _setEngineState: (state) => set({ engineState: state }),
  _setActiveLayerEntity: (layer) => set({ strokeTargetVisu: layer }),
}))

export const initializeOnlyUseEngineStore = createUseStore(engineStore)

export function usePaplicoInit(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { chatMode }: { chatMode?: boolean },
) {
  const papRef = useRef<Paplico | null>(null)
  const rerender = useUpdate()
  const engineStore = initializeOnlyUseEngineStore()
  const notifyStore = useNotifyStore()

  useDangerouslyEffectAsync(async () => {
    const pplc = new Paplico(canvasRef.current!, {
      paneComponentImpls: PaneUIImpls,
      paneCreateElement: createElement,
      // colorSpace: 'display-p3',
    })

    ;(window as any).pplc = pplc

    await pplc.brushes.register(ExtraBrushes.ScatterBrush)
    await pplc.fonts.requestToRegisterLocalFonts()

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
      engineStore._setActiveLayerEntity(null)
    })

    pplc.on('document:onUndo', () => {
      notifyStore.emit({ type: 'undo' })
    })
    pplc.on('document:onRedo', () => {
      notifyStore.emit({ type: 'redo' })
    })

    pplc.on('activeLayerChanged', ({ current }) => {
      engineStore._setActiveLayerEntity(
        current ? pplc.currentDocument!.getVisuByUid(current.layerUid)! : null,
      )
    })

    papRef.current = pplc
    rerender()
    engineStore.initialize(pplc)

    return () => {
      pplc.dispose()
    }
  }, [])

  useDangerouslyEffectAsync(() => {
    const handler = engineStore.canvasEditor
    if (!handler) return

    const offs = [
      handler.on('rasterToolModeChanged', ({ next }) => {
        notifyStore.emit({ type: 'toolChanged', tool: next })
      }),
      handler.on('vectorToolModeChanged', ({ next }) => {
        notifyStore.emit({ type: 'toolChanged', tool: next })
      }),
    ]

    return () => {
      offs.forEach((off) => off())
    }
  }, [engineStore.canvasEditor])

  useDangerouslyEffectAsync(() => {
    let pap = papRef.current
    if (!pap) return

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

    if (!chatMode) {
      pap.loadDocument(doc)
      // pap.setStrokingTargetLayer([raster.uid])

      pap!.setStrokingTarget([vectorGroupVis.uid])
      pap!.rerender()
    }

    // pap.strok
    pap.setBrushSetting({
      brushId: Brushes.CircleBrush.metadata.id,
      brushVersion: '0.0.1',
      color: { r: 0, g: 0, b: 0 },
      opacity: 0.4,
      size: 2,
      specific: {
        texture: 'pencil',
        noiseInfluence: 1,
        scatterRange: 0,
        randomScale: 10,
        randomRotation: 1,
        inOutInfluence: 1,
        inOutLength: 0.2,
      } satisfies Brushes.CircleBrush.Settings,
    })
  }, [papRef.current])

  usePaplicoChat(papRef, !!chatMode)
}

export function usePaplicoInstance() {
  // const store = useEngineStore(storePicker(['engine', 'editorHandle']))
  const store = initializeOnlyUseEngineStore()

  return useMemo(
    () => ({
      pplc: store._engine,
      canvasEditor: store.canvasEditor,
    }),
    [store, store._engine, store.canvasEditor],
  )
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
