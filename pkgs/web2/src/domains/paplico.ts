import { PaneUIImpls } from '@/components/FilterPane'
import { storePicker } from '@/utils/zutrand'
import {
  Brushes,
  Document,
  ExtraBrushes,
  Filters,
  Inks,
  Paplico,
  UIStroke,
} from '@paplico/core-new'
import { PaplicoEditorHandle } from '@paplico/vector-editor'
import { RefObject, createElement, useEffect, useMemo, useRef } from 'react'
import { useEffectOnce } from 'react-use'
import { create } from 'zustand'

interface Store {
  engine: Paplico | null
  engineState: Paplico.State | null
  editorHandle: PaplicoEditorHandle | null
  activeLayerEntity: Document.LayerEntity | null

  initialize(engine: Paplico): void
  _setEditorHandle: (handle: PaplicoEditorHandle | null) => void
  _setEngineState: (state: Paplico.State) => void
  _setActiveLayerEntity: (layer: Document.LayerEntity | null) => void
}

const useStore = create<Store>((set, get) => ({
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
  const store = useStore(
    storePicker('_setEngineState', '_setActiveLayerEntity', 'initialize'),
  )

  useEffectOnce(() => {
    let pap: Paplico
    ;(async () => {
      pap = papRef.current = new Paplico(canvasRef.current!, {
        paneComponentImpls: PaneUIImpls,
        paneCreateElement: createElement,
      })
      ;(window as any).pap = pap

      await pap.brushes.register(ExtraBrushes.ScatterBrush)
      await pap.fonts.requestToRegisterLocalFonts()

      pap.on('stateChanged', () => {
        store._setEngineState(pap.state)
      })

      pap.on('activeLayerChanged', ({ current }) => {
        if (!current) {
          store._setActiveLayerEntity(null)
          return
        }

        const layerEntity = pap.currentDocument!.resolveLayerEntity(
          current.layerUid,
        )
        store._setActiveLayerEntity(layerEntity!)
      })

      pap.on('documentChanged', () => {
        store._setActiveLayerEntity(null)
      })

      const doc = Document.createDocument({ width: 1000, height: 1000 })
      const raster = Document.createRasterLayerEntity({
        width: 1000,
        height: 1000,
      })

      const vector = Document.createVectorLayerEntity({
        filters: [
          Document.createFilterEntry({
            enabled: false,
            opacity: 1,
            filterId: Filters.TestFilter.metadata.id,
            filterVersion: Filters.TestFilter.metadata.version,
            settings: Filters.TestFilter.getInitialConfig(),
          }),
        ],
      })

      const text = Document.createTextLayerEntity({
        transform: {
          position: { x: 10, y: 120 },
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
        },
      )

      vector.objects.push(
        Document.createVectorObject({
          path: Document.createVectorPath({
            points: [
              { x: 0, y: 0, begin: null, end: null },
              { x: 1000, y: 1000, begin: null, end: null },
            ],
          }),
          filters: [
            {
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
                inkId: Inks.RainbowInk.id,
                inkVersion: Inks.RainbowInk.version,
                specific: {} satisfies Inks.RainbowInk.SpecificSetting,
              },
            },
          ],
        }),
      )

      doc.addLayer(
        Document.createVectorLayerEntity({
          objects: [
            Document.createVectorObject({
              path: Document.createVectorPath({
                points: [
                  { x: 0, y: 0, begin: null, end: null },
                  { x: 1000, y: 0, begin: null, end: null },
                  { x: 1000, y: 1000, begin: null, end: null },
                  { x: 0, y: 1000, begin: null, end: null },
                ],
                closed: true,
              }),
              filters: [
                // Document.createVectorAppearance({
                //   kind: 'fill',
                //   fill: {
                //     type: 'fill',
                //     color: { r: 0, g: 0, b: 1 },
                //     opacity: 1,
                //   },
                // }),
              ],
            }),
          ],
        }),
      )
      doc.addLayer(raster, [])
      doc.addLayer(vector, [])
      doc.addLayer(Document.createVectorLayerEntity({}), [])
      doc.addLayer(text, [])

      if (!chatMode) {
        pap.loadDocument(doc)
        // pap.setStrokingTargetLayer([raster.uid])
        pap.setStrokingTargetLayer([vector.uid])
        pap.rerender()
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

      store.initialize(pap)
    })()

    return () => {
      pap?.dispose()
    }
  })

  usePaplicoChat(papRef, !!chatMode)
}

export function usePaplico() {
  const store = useStore(storePicker('engine', 'editorHandle'))

  return useMemo(
    () => ({
      pap: store.engine,
      editorHandle: store.editorHandle,
    }),
    [store, store.engine, store.editorHandle],
  )
}

export const usePaplicoStore = useStore

function usePaplicoChat(papRef: RefObject<Paplico | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    if (!papRef.current) {
      console.info('Waiting for paplico to initialize...')
      return
    }

    const pap = papRef.current
    pap.loadDocument(null)

    console.info('⚡ Starting chat mode')

    const ws = new WebSocket(`ws://${location.hostname}:3003/chat-server`)

    pap.on('strokePreComplete', (e) => {
      ws.send(
        JSON.stringify({
          type: 'strokeComplete',
          uiStroke: e.stroke,
          strokeSettings: pap.state.currentStroke,
          targetLayerUid: pap.state.activeLayer!.layerUid,
        }),
      )
    })

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'join' }))
    })

    ws.addEventListener('message', (e) => {
      const message = JSON.parse(e.data)

      switch (message.type) {
        case 'joined': {
          const { roomId, layerIds } = message

          const doc = Document.createDocument({ width: 1000, height: 1000 })
          pap.loadDocument(doc)

          layerIds.forEach((layerId: string, idx: number) => {
            const layer = Document.createRasterLayerEntity({
              width: 1000,
              height: 1000,
              name: `Layer${idx + 1}`,
            })

            layer.uid = layerId
            doc.addLayer(layer)
          })

          pap.loadDocument(doc)
          pap.setStrokingTargetLayer([layerIds[0]])

          console.info(`⚡ Joined room: ${roomId}`)
          break
        }
        case 'strokeComplete': {
          console.log('⚡ receive strokeComplete')
          const { uiStroke, targetLayerUid, strokeSettings } = message
          pap.putStrokeComplete(Object.assign(new UIStroke(), uiStroke), {
            targetLayerUid,
            strokeSettings: strokeSettings,
          })
          break
        }
      }
    })

    return () => {
      ws.close()
    }
  }, [papRef.current])
}
