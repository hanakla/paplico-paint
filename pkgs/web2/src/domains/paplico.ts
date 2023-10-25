import {
  Brushes,
  Document,
  ExtraBrushes,
  Inks,
  Paplico,
} from '@paplico/core-new'
import { PaplicoEditorHandle } from '@paplico/vector-editor'
import { RefObject, useMemo, useRef } from 'react'
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

export const DEFAULT_BRUSH_ID = Brushes.CircleBrush.id
export const DEFAULT_BRUSH_VERSION = '0.0.1'

export function usePaplicoInit(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const papRef = useRef<Paplico | null>(null)
  const store = useStore()

  useEffectOnce(() => {
    let pap: Paplico
    ;(async () => {
      pap = papRef.current = new Paplico(canvasRef.current!)
      ;(window as any).pap = pap

      await pap.brushes.register(ExtraBrushes.ScatterBrush)

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

      const doc = Document.createDocument({ width: 1000, height: 1000 })
      const raster = Document.createRasterLayerEntity({
        width: 1000,
        height: 1000,
      })

      const vector = Document.createVectorLayerEntity({})
      vector.objects.push(
        Document.createVectorObject({
          path: Document.createVectorPath({
            points: [
              { x: 0, y: 0, begin: null, end: null },
              { x: 1000, y: 1000, begin: null, end: null },
            ],
          }),
          appearances: [
            {
              kind: 'stroke',
              stroke: {
                brushId: ExtraBrushes.ScatterBrush.id,
                brushVersion: '0.0.1',
                color: { r: 1, g: 1, b: 0 },
                opacity: 1,
                size: 30,
                specific: {
                  texture: 'pencil',
                  noiseInfluence: 1,
                  inOutInfluence: 0,
                  inOutLength: 0,
                } satisfies ExtraBrushes.ScatterBrush.SpecificSetting,
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

      doc.addLayer(raster, [])
      doc.addLayer(vector, [])
      doc.addLayer(Document.createVectorLayerEntity({}), [])

      pap.loadDocument(doc)
      // pap.enterLayer([raster.uid])
      pap.enterLayer([vector.uid])
      pap.rerender()

      // pap.strok
      pap.setStrokeSetting({
        brushId: Brushes.CircleBrush.id,
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
        } satisfies Brushes.CircleBrush.SpecificSetting,
      })

      store.initialize(pap)
    })()

    return () => {
      console.log('dispose')
      console.log('dispose')
      pap?.dispose()
    }
  })
}

export function usePaplico() {
  const store = useStore()

  return useMemo(
    () => ({
      pap: store.engine,
      editorHandle: store.editorHandle,
      papStore: store,
    }),
    [store, store.engine, store.editorHandle],
  )
}
