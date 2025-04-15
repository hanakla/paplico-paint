'use client'

import { useGlobalMousetrap } from '@/utils/hooks'
import '../../globals.css'
import Paplico, {
  Brushes,
  Document,
  ExtraBrushes,
  Inks,
} from '@paplico/core-new'
import { bindPaplico, ToolModes } from '@paplico/editor'
import { useEffect, useRef } from 'react'
import useMeasure from 'use-measure'
import { useUpdate } from 'react-use'

export default function DevPage() {
  const engineRef = useRef<Paplico | null>(null)
  const uiRef = useRef<ReturnType<typeof bindPaplico> | null>(null)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const rerender = useUpdate()

  const m = useMeasure(canvasRef)

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = (engineRef.current = new Paplico(canvasRef.current))
    const ui = (uiRef.current = bindPaplico(
      rootRef.current!,
      canvasRef.current!,
      engine,
    ))

    engine.brushes.register(ExtraBrushes.ScatterBrush)

    const doc = new Document.PaplicoDocument({ width: 1000, height: 1000 })

    doc.layerNodes.addLayerNode(
      Document.visu.createVectorObjectVisually({
        transform: {
          ...Document.visu.DEFAULT_VISU_TRANSFORM(),
          translate: { x: 10, y: 10 },
          scale: { x: 1.1, y: 1.1 },
        },
        filters: [
          Document.visu.createVisuallyFilter('fill', {
            fill: {
              type: 'fill',
              color: { r: 1, g: 0, b: 0 },
              opacity: 1,
            },
          }),
        ],
        path: Document.visu.createVectorPath({
          points: [
            { isMoveTo: true, x: 0, y: 0 },
            { x: 0, y: 100, begin: null, end: null },
            { x: 100, y: 100, begin: null, end: null },
            { x: 100, y: 0, begin: null, end: null },
          ],
        }),
      }),
    )

    // const layer = Document.visu.createGroupVisually({})

    doc.layerNodes.addLayerNode(
      Document.visu.createVectorObjectVisually({
        transform: {
          ...Document.visu.DEFAULT_VISU_TRANSFORM(),
          translate: { x: 10, y: 10 },
          scale: { x: 1.1, y: 1.1 },
        },
        filters: [
          Document.visu.createVisuallyFilter('fill', {
            fill: {
              type: 'fill',
              color: { r: 0, g: 0.5, b: 0.5 },
              opacity: 1,
            },
          }),
        ],
        path: Document.visu.createVectorPath({
          points: [
            { isMoveTo: true, x: 1000, y: 1000 },
            { x: 1000, y: 500, begin: null, end: null },
            { x: 500, y: 500, begin: null, end: null },
            { x: 500, y: 1000, begin: null, end: null },
          ],
        }),
      }),
      [],
      -1,
    )

    engine.loadDocument(doc)

    engine.setViewport({
      top: -m.width / 2,
      left: -m.height / 2,
      width: m.width,
      height: m.height,
    })

    engine.setStrokeCompositionMode('normal')
    engine.setBrushSetting({
      brushId: Brushes.CircleBrush.metadata.id,
      brushVersion: Brushes.CircleBrush.metadata.version,
      size: 10,
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
      settings: {
        lineCap: 'round',
      } satisfies Brushes.CircleBrush.Settings,
    })
    // engine.setBrushSetting({
    //   brushId: ExtraBrushes.ScatterBrush.metadata.id,
    //   brushVersion: ExtraBrushes.ScatterBrush.metadata.version,
    //   size: 10,
    //   color: { r: 0, g: 0, b: 0 },
    //   opacity: 1,
    //   settings: {
    //     ...ExtraBrushes.ScatterBrush.getInitialSetting(),
    //   } satisfies ExtraBrushes.ScatterBrush.Settings,
    // })
    ui.setToolMode(ToolModes.scroll)
    engine.setBrushSetting({
      brushId: ExtraBrushes.ScatterBrush.metadata.id,
      brushVersion: ExtraBrushes.ScatterBrush.metadata.version,
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
      size: 10,
      settings: {
        ...ExtraBrushes.ScatterBrush.getInitialSetting(),
        texture: 'pencil',
      } satisfies ExtraBrushes.ScatterBrush.Settings,
    })
    ui.setStrokingTarget([])

    engine.on('finishRenderCompleted', rerender)

    window._pap = engine

    return () => {
      engine.dispose()
    }
  }, [])

  useGlobalMousetrap(['b'], () => {
    uiRef.current?.setToolMode('strokingTool')
  })

  useGlobalMousetrap(['r'], () => {
    engineRef.current?.setViewport({
      top: -m.width / 2,
      left: -m.height / 2,
      width: m.width,
      height: m.height,
    })
  })

  useGlobalMousetrap(['space'], () => {
    uiRef.current?.setToolMode('scroll')
  })

  return (
    <div className="relative">
      <div ref={rootRef} className="absolute pointer-events-none"></div>
      <canvas
        ref={canvasRef}
        width={1000}
        height={1000}
        className="border-red-500 border-[1px]"
      />
      {JSON.stringify(engineRef.current?.getViewport())}
    </div>
  )
}
