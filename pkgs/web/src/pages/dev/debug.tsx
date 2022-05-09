import { loadImageFromBlob, useAsyncEffect, useFunk } from '@hanakla/arma'
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { rgba } from 'polished'
import { MouseEvent, useEffect, useRef, useState } from 'react'
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
import { centering, checkerBoard } from '🙌/utils/mixins'
import { DifferenceRender } from '@paplico/core/dist/engine/RenderStrategy/DifferenceRender'
import { roundString } from '../../utils/StringUtils'

export default function Debug() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sessionRef = useRef<PapSession | null>(null)
  const benchRef = useRef<{ start: () => void; stop: () => void } | null>(null)
  const controlRef = useRef<{ toggleFilters: () => void } | null>(null)

  const [imageUrl, setImageUrl] = useState('')
  const [strategy, setStrategy] = useState<'difference' | 'full'>('difference')
  const [bgColor, setBGColor] = useState('#fff')
  const [point, setPointedColor] = useState({
    x: -1,
    y: -1,
    r: 0,
    g: 0,
    b: 0,
    a: 0,
  })

  const handleCanvasMouseMove = useFunk((e: MouseEvent<HTMLCanvasElement>) => {
    const box = canvasRef.current!.getBoundingClientRect()
    const pos = {
      x: Math.floor(e.clientX - box.left),
      y: Math.floor(e.clientY - box.top),
    }
    const pixel = canvasRef.current
      ?.getContext('2d')!
      .getImageData(pos.x, pos.y, 1, 1)
    if (!pixel) return

    setPointedColor({
      x: pos.x,
      y: pos.y,
      r: pixel.data[0],
      g: pixel.data[1],
      b: pixel.data[2],
      a: pixel.data[3],
    })
  })

  useAsyncEffect(async () => {
    setTimeout(async () => {
      const engine = ((window as any)._engine = await PaplicoEngine.create({
        canvas: canvasRef.current!,
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

      new CanvasHandler(canvasRef.current!).connect(
        session,
        session.renderStrategy as any,
        engine
      )

      {
        const document = PapDOM.Document.create({ width: 1000, height: 1000 })
        const raster = PapDOM.RasterLayer.create({ width: 1000, height: 1000 })
        const strategy = new RenderStrategies.FullRender()
        const vector = PapDOM.VectorLayer.create({
          compositeMode: 'overlay',
        })
        const bgLayer = PapDOM.VectorLayer.create({})
        const filter = PapDOM.FilterLayer.create({})

        bgLayer.objects.push(
          PapDOM.VectorObject.create({
            x: 0,
            y: 0,
            path: PapDOM.Path.create({
              points: [
                { x: 0, y: 0, in: null, out: null },
                { x: document.width, y: 0, in: null, out: null },
                { x: document.width, y: document.height, in: null, out: null },
                { x: 0, y: document.height, in: null, out: null },
              ],
              closed: true,
            }),
            brush: null,
            fill: {
              type: 'fill',
              color: { r: 0, g: 0, b: 0 },
              opacity: 1,
            },
          })
        )

        {
          const path = PapDOM.Path.create({
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

          const obj = PapDOM.VectorObject.create({ x: 0, y: 0, path })

          // obj.brush = {
          //   brushId: PapBrushes.ScatterBrush.id,
          //   color: { r: 0, g: 0, b: 0 },
          //   opacity: 1,
          //   size: 4,
          //   specific: {},
          // }
          obj.brush = null

          obj.fill = {
            type: 'linear-gradient',
            opacity: 1,
            start: { x: -100, y: -100 },
            end: { x: 100, y: 100 },
            colorStops: [
              { color: { r: 0, g: 255, b: 255, a: 1 }, position: 0 },
              { color: { r: 255, g: 255, b: 0, a: 1 }, position: 1 },
            ],
          }

          vector.objects.push(obj)
        }

        vector.filters.push(
          // PapDOM.Filter.create({
          //   filterId: '@paplico/filters/chromatic-aberration',
          //   visible: true,
          //   settings: {
          //     ...engine.toolRegistry.getFilterInstance(
          //       '@paplico/filters/chromatic-aberration'
          //     )!.initialConfig,
          //     size: 100,
          //   },
          // })
          // PapDOM.Filter.create({
          //   filterId: '@paplico/filters/halftone',
          //   visible: true,
          //   settings: {
          //     ...engine.toolRegistry.getFilterInstance(
          //       '@paplico/filters/halftone'
          //     )!.initialConfig,
          //     size: 100,
          //   },
          // }),
          // PapDOM.Filter.create({
          //   filterId: '@paplico/gauss-blur',
          //   visible: true,
          //   settings: engine.toolRegistry.getFilterInstance(
          //     '@paplico/gauss-blur'
          //   )!.initialConfig,
          // }),
          // PapDOM.Filter.create({
          //   filterId: '@paplico/filters/outline',
          //   visible: true,
          //   settings: engine.toolRegistry.getFilterInstance(
          //     '@paplico/filters/outline'
          //   )!.initialConfig,
          // }),
          // PapDOM.Filter.create({
          //   filterId: '@paplico/filters/zoom-blur',
          //   visible: false,
          //   settings: engine.toolRegistry.getFilterInstance(
          //     '@paplico/filters/zoom-blur'
          //   )!.initialConfig,
          // }),
          PapDOM.Filter.create({
            filterId: '@paplico/filters/kawase-blur',
            visible: true,
            settings: engine.toolRegistry.getFilterInstance(
              '@paplico/filters/kawase-blur'
            )!.initialConfig,
          }),
          ...[]
        )

        filter.filters = [
          // PapDOM.Filter.create({
          //   filterId: '@paplico/filters/kawase-blur',
          //   visible: true,
          //   settings: engine.toolRegistry.getFilterInstance(
          //     '@paplico/filters/kawase-blur'
          //   )!.initialConfig,
          // }),
        ]

        // document.addLayer(bgLayer)
        document.addLayer(raster)
        document.addLayer(vector, { aboveLayerId: raster.uid })
        // document.addLayer(filter, { aboveLayerId: vector.uid })
        session.setDocument(document)
        session.setActiveLayer([vector.uid])

        canvasRef.current!.width = document.width
        canvasRef.current!.height = document.height

        await engine.render(document, strategy)

        const { image, url } = await loadImageFromBlob(
          await new Promise<Blob>((r) =>
            canvasRef
              .current!.getContext('2d')!
              .canvas.toBlob((b) => r(b!), 'image/png')
          )
        )

        setImageUrl(url)

        window.document.getElementById('hihi')?.appendChild(engine.gl.gl.canvas)

        console.log({
          engine,
          session,
          document,
          rerender: () => engine.render(document, strategy),
        })

        controlRef.current = {
          toggleFilters: () => {
            vector.filters.forEach(
              (filter) => (filter.visible = !filter.visible)
            )
            ;(session.renderStrategy as DifferenceRender).markUpdatedLayerId(
              vector.uid
            )
            engine.render(session.document!, session.renderStrategy)
          },
        }
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
      <Stack
        css={`
          padding: 8px;
        `}
        dir="vertical"
      >
        <Stack dir="horizontal" gap={16}>
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

          <Stack
            css={`
              ${centering()}
            `}
            dir="horizontal"
          >
            背景色
            <BGColor color="#fff" onClick={(color) => setBGColor(color)} />
            <BGColor color="#000" onClick={(color) => setBGColor(color)} />
            <BGColor color="#aaa" onClick={(color) => setBGColor(color)} />
          </Stack>
        </Stack>

        <Stack dir="horizontal" gap={16}>
          <Stack
            css={`
              ${centering()}
            `}
            dir="horizontal"
          >
            <Button
              kind="normal"
              onClick={() => controlRef.current!.toggleFilters()}
            >
              フィルター切り替え
            </Button>
          </Stack>
        </Stack>

        <div>
          <span
            css={`
              ${checkerBoard({ size: 8 })}
            `}
          >
            <span
              css={`
                display: inline-block;
                float: left;
                margin-right: 4px;
                width: 24px;
                height: 24px;
                border: 1px solid #000;
              `}
              style={{
                backgroundColor: rgba(
                  point.r,
                  point.g,
                  point.b,
                  Math.round((point.a / 255) * 10 ** 2) / 10 ** 2
                ),
              }}
            />
          </span>
          Coord: {point.x} {point.y}
          <br />
          R: {roundString(point.r / 255, 2)} ({point.r}) G:{' '}
          {roundString(point.g / 255, 2)} ({point.g}) B:{' '}
          {roundString(point.b / 255, 2)} ({point.b}) A:{' '}
          {roundString(point.a / 255, 2)} ({point.a})
        </div>
      </Stack>

      <Stack
        css={`
          background-color: ${bgColor};
        `}
        dir="horizontal"
      >
        <div>
          Canvas <br />
          <canvas
            ref={canvasRef}
            css={`
              width: 400px;
              height: 400px;
              margin: 16px;
              box-shadow: 0 0 4px ${rgba('#000', 0.4)};
              /* background-color: red; */
              /* ${checkerBoard({ size: 8 })} */
              transition: none !important;
            `}
            onMouseMove={handleCanvasMouseMove}
          />
        </div>

        <div>
          Exported (&lt;img /&gt;)
          <br />
          <img
            css={`
              width: 400px;
              height: 400px;
            `}
            src={imageUrl}
          />
        </div>

        <div id="hihi" />
      </Stack>
    </DevLayout>
  )
}

const BGColor = ({
  color,
  onClick,
}: {
  color: string
  onClick: (color: string) => void
}) => {
  return (
    <div
      css={`
        width: 24px;
        height: 24px;
        border: 1px solid #000;
      `}
      style={{ backgroundColor: color }}
      onClick={() => {
        onClick(color)
      }}
    />
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  return {
    props: {},
    notFound: process.env.NODE_ENV !== 'production' ? false : true,
  }
}
