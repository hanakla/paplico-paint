import { useAsyncEffect } from '@hanakla/arma'
import { GetServerSideProps } from 'next'
import { rgba } from 'polished'
import { useEffect, useRef } from 'react'
import {
  CanvasHandler,
  RenderStrategies,
  Silk3,
  SilkBrushes,
  SilkDOM,
  SilkSession,
} from 'silk-core'

export default function Debug() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useAsyncEffect(async () => {
    setTimeout(async () => {
      const engine = ((window as any)._eninge = await Silk3.create({
        canvas: ref.current!,
      }))
      const session = ((window as any)._session = await SilkSession.create())
      session.renderStrategy = new RenderStrategies.DifferenceRender()

      session.pencilMode = 'draw'
      session.setBrushSetting({
        brushId: SilkBrushes.ScatterBrush.id,
        size: 3,
        color: { r: 0.2, g: 0.2, b: 0.2 },
      })

      new CanvasHandler(ref.current!).connect(
        session,
        session.renderStrategy as any,
        engine
      )

      {
        const document = SilkDOM.Document.create({ width: 1000, height: 1000 })
        const raster = SilkDOM.RasterLayer.create({ width: 1000, height: 1000 })
        const strategy = new RenderStrategies.FullRender()
        const vector = SilkDOM.VectorLayer.create({})

        if (process.env.NODE_ENV === 'development') {
          const path = SilkDOM.Path.create({
            points: [
              { x: 0, y: 0, in: null, out: null },
              { x: 200, y: 500, in: null, out: null },
              { x: 600, y: 500, in: null, out: null },
              {
                x: 1000,
                y: 1000,
                in: null,
                out: null,
              },
            ],
            closed: true,
          })

          const obj = SilkDOM.VectorObject.create({ x: 0, y: 0, path })

          obj.brush = {
            brushId: SilkBrushes.ScatterBrush.id,
            color: { r: 0, g: 0, b: 0 },
            opacity: 1,
            size: 2,
          }
          obj.brush = null

          obj.fill = {
            type: 'linear-gradient',
            opacity: 1,
            start: { x: -100, y: -100 },
            end: { x: 100, y: 100 },
            colorStops: [
              { color: { r: 0, g: 255, b: 255, a: 1 }, position: 0 },
              { color: { r: 128, g: 255, b: 200, a: 1 }, position: 1 },
            ],
          }

          vector.objects.push(obj)
        }

        vector.filters.push(
          SilkDOM.Filter.create({
            filterId: '@silk-core/chromatic-aberration',
            visible: false,
            settings: {
              ...engine.toolRegistry.getFilterInstance(
                '@silk-core/chromatic-aberration'
              )!.initialConfig,
              size: 100,
            },
          }),
          SilkDOM.Filter.create({
            filterId: '@silk-core/gauss-blur',
            visible: false,
            settings: engine.toolRegistry.getFilterInstance(
              '@silk-core/gauss-blur'
            )!.initialConfig,
          }),
          SilkDOM.Filter.create({
            filterId: '@silk-core/outline',
            visible: true,
            settings:
              engine.toolRegistry.getFilterInstance('@silk-core/outline')!
                .initialConfig,
          })
        )

        document.addLayer(raster)
        document.addLayer(vector, { aboveLayerId: raster.uid })
        session.setDocument(document)
        session.setActiveLayer([raster.uid])

        ref.current!.width = document.width
        ref.current!.height = document.height

        await engine.render(document, strategy)

        console.log({
          engine,
          session,
          document,
          rerender: () => engine.render(document, strategy),
        })
      }
    }, 800)

    return () => {}
  }, [])

  return (
    <div>
      <canvas
        ref={ref}
        css={`
          margin: 16px;
          box-shadow: 0 0 4px ${rgba('#000', 0.4)};
        `}
      />
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  return {
    props: {},
    notFound: process.env.NODE_ENV !== 'production' ? false : true,
  }
}
