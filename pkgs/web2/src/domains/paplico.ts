import {
  Brushes,
  Document,
  ExtraBrushes,
  Inks,
  Paplico,
} from '@paplico/core-new'
import { RefObject, useMemo, useRef } from 'react'
import { useEffectOnce } from 'react-use'
import { create } from 'zustand'
import { useStableLatestRef } from '../utils/hooks'

type CanvasTransform = {
  x: number
  y: number
  scale: number
  rotateDeg: number
}

interface Store {
  engine: Paplico | null
  engineState: Paplico.State | null
  canvasTransform: CanvasTransform

  initialize(engine: Paplico): void
  setEngineState: (state: Paplico.State) => void
  setCanvasTransform: (
    translator: (prev: CanvasTransform) => CanvasTransform,
  ) => void
}

const useStore = create<Store>((set, get) => ({
  engine: null,
  engineState: null,
  canvasTransform: { x: 0, y: 0, scale: 1, rotateDeg: 0 },

  initialize: (engine: Paplico) => {
    set({ engine })
  },
  setEngineState: (state) => set({ engineState: state }),
  setCanvasTransform: (translator) => {
    set({ canvasTransform: translator(get().canvasTransform) })
  },
}))

export function usePaplicoInit(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const papRef = useRef<Paplico | null>(null)
  const store = useStore()

  useEffectOnce(() => {
    ;(async () => {
      const pap = (papRef.current = new Paplico(canvasRef.current!))
      ;(window as any).pap = pap

      await pap.brushes.register(ExtraBrushes.ScatterBrush)

      pap.on('stateChanged', () => {
        store.setEngineState(pap.state)
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

      doc.layerEntities.push(vector)
      doc.layerEntities.push(raster)
      doc.layerTree.push({ layerUid: vector.uid, children: [] })
      doc.layerTree.push({ layerUid: raster.uid, children: [] })

      pap.loadDocument(doc)
      pap.enterLayer([raster.uid])
      // pap.enterLayer([vector.uid])
      pap.rerender()

      // pap.strok
      pap.strokeSetting = {
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
      }

      store.initialize(pap)

      return () => {
        pap.dispose()
      }
    })()
  })
}

export function usePaplico(canvasRef?: RefObject<HTMLCanvasElement | null>) {
  const store = useStore()

  return {
    pap: store.engine,
    // engineState: store.engineState,
    papStore: store,
  }
}
