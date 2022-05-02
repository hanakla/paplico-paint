import { useAsyncEffect } from '@hanakla/arma'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { rgba } from 'polished'
import { useEffect, useRef, useState } from 'react'
import {
  CanvasHandler,
  RenderStrategies,
  PaplicoEngine,
  PapBrushes,
  PapDOM,
  PapSession,
} from '@paplico/core'

import { Button } from '🙌/components/Button'
import { Stack } from '🙌/components/Stack'
import { DevLayout } from '🙌/layouts/DevLayout'
import { centering } from '🙌/utils/mixins'

export default function ManyLayers() {
  const router = useRouter()
  const ref = useRef<HTMLCanvasElement | null>(null)
  const sessionRef = useRef<PapSession | null>(null)
  const benchRef = useRef<{ start: () => void; stop: () => void } | null>(null)
  const [strategy, setStrategy] = useState<'difference' | 'full'>('difference')

  useAsyncEffect(async () => {
    setTimeout(async () => {
      const engine = ((window as any)._eninge = await PaplicoEngine.create({
        canvas: ref.current!,
      }))
      const session =
        (sessionRef.current =
        (window as any)._session =
          await PapSession.create())
      session.renderStrategy = new RenderStrategies.DifferenceRender()

      session.pencilMode = 'draw'
      session.setBrushSetting({
        brushId: PapBrushes.ScatterBrush.id,
        size: 20,
        color: { r: 0.2, g: 0.2, b: 0.2 },
      })

      new CanvasHandler(ref.current!).connect(
        session,
        session.renderStrategy as any,
        engine
      )

      {
        const document = PapDOM.Document.create({ width: 1000, height: 1000 })
        const strategy = new RenderStrategies.FullRender()

        Array.from({ length: 200 }).forEach(() => {
          const raster = PapDOM.RasterLayer.create({
            width: 1000,
            height: 1000,
          })
          document.addLayer(raster)
        })

        session.setDocument(document)
        session.setActiveLayer([document.layers[0].uid])

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

      benchRef.current = {
        start: () => {},
        stop: () => {},
      }

      let frames = 0
      let lastLogTime: number | null = null
      let animId = -1

      const render = async function (time: number) {
        lastLogTime ??= time

        await engine.render(session.document!, session.renderStrategy)
        frames++

        if (time - lastLogTime > 1000) {
          console.log(
            `current fps: ${frames} frames in ${time - lastLogTime}ms`
          )
          lastLogTime = time
          frames = 0
        }

        animId = requestAnimationFrame(render)
      }

      benchRef.current = {
        start: () => {
          console.log('Benchmarking...')
          requestAnimationFrame(render)
        },
        stop: () => cancelAnimationFrame(animId),
      }
    }, 800)

    return () => {}
  }, [])

  return (
    <DevLayout>
      <div
        css={`
          display: flex;
          gap: 8px;
          padding: 8px;
          flex-flow: row;
        `}
      >
        <Stack
          css={`
            ${centering()}
          `}
          dir="horizontal"
        >
          <strong>モード</strong>
          <Button
            kind={strategy === 'difference' ? 'primary' : 'normal'}
            onClick={() => {
              setStrategy('difference')
              sessionRef.current!.setRenderStrategy(
                new RenderStrategies.DifferenceRender()
              )
            }}
          >
            DifferenceRender
          </Button>
          <Button
            kind={strategy === 'full' ? 'primary' : 'normal'}
            onClick={() => {
              setStrategy('full')
              sessionRef.current!.setRenderStrategy(
                new RenderStrategies.FullRender()
              )
            }}
          >
            FullRender
          </Button>
        </Stack>

        <Stack
          css={`
            ${centering()}
          `}
          dir="horizontal"
        >
          <strong>ベンチマーク</strong>
          <Button kind="normal" onClick={() => benchRef.current!.start()}>
            開始
          </Button>
          <Button kind="normal" onClick={() => benchRef.current!.stop()}>
            停止
          </Button>
        </Stack>
      </div>
      <canvas
        ref={ref}
        css={`
          margin: 16px;
          box-shadow: 0 0 4px ${rgba('#000', 0.4)};
        `}
      />
    </DevLayout>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  return {
    props: {},
    notFound: process.env.NODE_ENV !== 'production' ? false : true,
  }
}
