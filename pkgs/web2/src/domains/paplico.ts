import { PaneUIImpls } from '@/components/FilterPane'
import { storePicker } from '@/utils/zutrand'
import {
  Brushes,
  Document,
  ExtraBrushes,
  Filters,
  Inks,
  Paplico,
} from '@paplico/core-new'
import { PapEditorHandle } from '@paplico/editor'
import { RefObject, createElement, useEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { PaplicoChatWebSocketBackend, paplicoChat } from '@paplico/chat/client'
import { useDangerouslyEffectAsync } from '@/utils/hooks'
import { useUpdate } from 'react-use'
import { useNotifyStore } from './notifications'

interface Store {
  engine: Paplico | null
  engineState: Paplico.State | null
  editorHandle: PapEditorHandle | null
  activeLayerEntity: Document.LayerEntity | null

  initialize(engine: Paplico): void
  _setEditorHandle: (handle: PapEditorHandle | null) => void
  _setEngineState: (state: Paplico.State) => void
  _setActiveLayerEntity: (layer: Document.LayerEntity | null) => void
}

export const useEngineStore = create<Store>((set, get) => ({
  engine: null,
  engineState: null,
  activeLayerEntity: null,
  editorHandle: null,

  initialize: (engine: Paplico) => {
    set({ engine })
  },

  _setEditorHandle: (handle) => {
    set({ editorHandle: handle })
  },
  _setEngineState: (state) => set({ engineState: state }),
  _setActiveLayerEntity: (layer) => set({ activeLayerEntity: layer }),
}))

export const DEFAULT_BRUSH_ID = Brushes.CircleBrush.metadata.id
export const DEFAULT_BRUSH_VERSION = '0.0.1'

export function usePaplicoInit(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { chatMode }: { chatMode?: boolean },
) {
  const papRef = useRef<Paplico | null>(null)
  const rerender = useUpdate()
  const engineStore = useEngineStore(
    storePicker([
      '_setEngineState',
      '_setActiveLayerEntity',
      'initialize',
      'editorHandle',
    ]),
  )
  const notifyStore = useNotifyStore()

  useDangerouslyEffectAsync(async () => {
    const pap = new Paplico(canvasRef.current!, {
      paneComponentImpls: PaneUIImpls,
      paneCreateElement: createElement,
    })

    ;(window as any).pap = pap

    await pap.brushes.register(ExtraBrushes.ScatterBrush)
    await pap.fonts.requestToRegisterLocalFonts()

    pap.on('stateChanged', () => {
      engineStore._setEngineState(pap.state)
    })

    pap.on('document:layerUpdated', ({ current }) => {
      if (!current) {
        engineStore._setActiveLayerEntity(null)
        return
      }

      const layerEntity = pap.currentDocument!.resolveLayerEntity(
        current.layerUid,
      )
      engineStore._setActiveLayerEntity(layerEntity!)
    })

    pap.on('documentChanged', () => {
      engineStore._setActiveLayerEntity(null)
    })

    pap.on('document:onUndo', () => {
      notifyStore.emit({ type: 'undo' })
    })
    pap.on('document:onRedo', () => {
      notifyStore.emit({ type: 'redo' })
    })

    pap.on('activeLayerChanged', ({ current }) => {
      engineStore._setActiveLayerEntity(
        current
          ? pap.currentDocument!.resolveLayerEntity(current.layerUid)!
          : null,
      )
    })

    papRef.current = pap
    rerender()
    engineStore.initialize(pap)

    return () => {
      pap.dispose()
    }
  }, [])

  useDangerouslyEffectAsync(() => {
    const handler = engineStore.editorHandle
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
  }, [engineStore.editorHandle])

  useDangerouslyEffectAsync(() => {
    let pap = papRef.current
    if (!pap) return

    const doc = Document.createDocument({ width: 1000, height: 1000 })
    const raster = Document.createRasterLayerEntity({
      width: 1000,
      height: 1000,
      // compositeMode: 'multiply',
    })

    const vector = Document.createVectorLayerEntity({
      filters: [
        Document.createFilterEntry({
          enabled: false,
          opacity: 1,
          filterId: Filters.TestFilter.metadata.id,
          filterVersion: Filters.TestFilter.metadata.version,
          settings: Filters.TestFilter.getInitialSetting(),
        }),
      ],
    })
    vector.objects.push(
      Document.createVectorObject({
        path: Document.createVectorPath({
          points: [
            { isMoveTo: true, x: 0, y: 0 },
            { x: 1000, y: 1000, begin: null, end: null },
          ],
        }),
        filters: [
          Document.createVectorAppearance({
            kind: 'stroke',
            stroke: {
              brushId: ExtraBrushes.ScatterBrush.metadata.id,
              brushVersion: '0.0.1',
              color: { r: 1, g: 1, b: 0 },
              opacity: 1,
              size: 30,
              specific: {
                texture: 'pencil',
                noiseInfluence: 1,
                inOutInfluence: 0,
                inOutLength: 0,
              } satisfies ExtraBrushes.ScatterBrush.Settings,
            },
            ink: {
              inkId: Inks.TextureReadInk.id,
              inkVersion: Inks.TextureReadInk.version,
              specific: {} satisfies Inks.TextureReadInk.SpecificSetting,
            },
          }),
        ],
      }),
    )

    const text = Document.createTextLayerEntity({
      transform: {
        position: { x: 16, y: 16 },
        scale: { x: 1, y: 1 },
        rotate: 0,
      },
      fontFamily: 'Poppins',
      fontStyle: 'Bold',
      fontSize: 64,
    })
    text.textNodes.push(
      { text: 'PAPLIC-o-\n', position: { x: 0, y: 0 } },
      {
        text: 'MAGIC',
        fontSize: 128,
        position: { x: 0, y: 0 },
        // color: { r: 0, g: 0.5, b: 0.5, a: 1 },
      },
    )

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

    doc.addLayer(vector, [])
    doc.addLayer(raster, [])
    doc.addLayer(text, [])

    if (!chatMode) {
      pap.loadDocument(doc)
      // pap.setStrokingTargetLayer([raster.uid])

      pap!.setStrokingTargetLayer([vector.uid])
      pap!.rerender()
    }

    // pap.strok
    pap.setStrokeSetting({
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
  const store = useEngineStore(storePicker(['engine', 'editorHandle']))

  return useMemo(
    () => ({
      pap: store.engine,
      editorHandle: store.editorHandle,
    }),
    [store, store.engine, store.editorHandle],
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
