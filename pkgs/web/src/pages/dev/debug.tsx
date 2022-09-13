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
  PapFilters,
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
  const controlRef = useRef<{
    rerender: () => void
    rerenderWithoutCache: () => void
    toggleFilters: () => void
  } | null>(null)

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
        const strategy = session.renderStrategy
        const vector = PapDOM.VectorLayer.create({
          // compositeMode: 'overlay',
        })

        const square = PapDOM.VectorLayer.create({
          name: 'square',
          objects: [
            PapDOM.VectorObject.create({
              mode: 'clipping',
              fill: {
                type: 'fill',
                color: { r: 1, g: 1, b: 1 },
                opacity: 1,
              },
              path: PapDOM.Path.create({
                closed: true,
                points: [
                  {
                    x: document.width / 2 - 200,
                    y: document.height / 2 - 200,
                    in: null,
                    out: null,
                  },
                  {
                    x: document.width / 2 + 200,
                    y: document.height / 2 - 200,
                    in: null,
                    out: null,
                  },
                  {
                    x: document.width / 2 + 200,
                    y: document.height / 2 + 200,
                    in: null,
                    out: null,
                  },
                  {
                    x: document.width / 2 - 200,
                    y: document.height / 2 + 200,
                    in: null,
                    out: null,
                  },
                ],
              }),
            }),
          ],
        })

        square.objects[0].objects.push(
          PapDOM.VectorObject.create({
            fill: { type: 'fill', color: { r: 0, g: 1, b: 1 }, opacity: 0.5 },
            path: PapDOM.Path.create({
              points: [
                {
                  x: 0,
                  y: 0,
                  in: null,
                  out: null,
                },
                {
                  x: document.width,
                  y: 0,
                  in: null,
                  out: null,
                },
                {
                  x: 0,
                  y: document.height,
                  in: null,
                  out: null,
                },
              ],
              closed: true,
            }),
          })
        )

        const strokes = PapDOM.VectorLayer.create({
          name: 'strokes',
          opacity: 100,
          objects: [
            PapDOM.VectorObject.create({
              brush: {
                brushId: PapBrushes.ScatterBrush.id,
                size: 50,
                color: { r: 0, g: 0, b: 0 },
                opacity: 1,
                specific: {
                  texture: 'fadeBrush',
                } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
              },
              path: PapDOM.Path.create({
                points: [
                  { x: 0, y: 0, in: null, out: null },
                  {
                    x: document.width,
                    y: document.height,
                    in: null,
                    out: null,
                  },
                ],
                closed: false,
              }),
            }),
            ...Array.from({ length: 10 }).map((_, i, { length }) =>
              PapDOM.VectorObject.create({
                x: -20,
                y: 100,
                brush: {
                  brushId: PapBrushes.ScatterBrush.id,
                  size: 100,
                  color: { r: i / length, g: 1 - i / length, b: i / length },
                  opacity: 0.6,
                  specific: {
                    texture: 'fadeBrush',
                    fadeWeight: 0.7,
                    inOutInfluence: 0.2,
                  } as Partial<PapBrushes.ScatterBrush.SpecificSetting>,
                },
                path: PapDOM.Path.create({
                  points: [
                    {
                      x: document.width - i * 100,
                      y: 0 + i * 10,
                      in: null,
                      out: null,
                    },
                    {
                      x: 0 + i * 70,
                      y: document.height + i * 20,
                      in: null,
                      out: null,
                    },
                  ],
                  closed: false,
                }),
              })
            ),
          ],
        })
        const bgLayer = PapDOM.VectorLayer.create({ visible: true })
        const displacement = PapDOM.VectorLayer.create({ visible: false })
        const filter = PapDOM.FilterLayer.create({})

        displacement.objects.push(
          PapDOM.VectorObject.create({
            visible: true,
            x: 0,
            y: 0,
            path: PapDOM.Path.create({
              points: [
                { x: document.width, y: 0, in: null, out: null },
                { x: document.width, y: document.height, in: null, out: null },
                { x: 0, y: document.height, in: null, out: null },
              ],
              closed: true,
            }),
            brush: null,
            fill: {
              type: 'linear-gradient',
              colorStops: [
                // { color: { r: 1, g: 0, b: 0, a: 1 }, position: 0 },
                { color: { r: 0, g: 0, b: 0, a: 1 }, position: 0 },
                { color: { r: 0, g: 1, b: 0, a: 1 }, position: 1 },
              ],
              start: { x: document.width / 2, y: -document.height / 2 },
              end: {
                x: document.width / 2,
                y: document.height / 2,
              },
              opacity: 1,
            },
          })
        )

        bgLayer.objects.push(
          PapDOM.VectorObject.create({
            visible: true,
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
              color: { r: 195 / 255, g: 221 / 255, b: 25 / 255 },
              opacity: 1,
            },
          })
        )

        {
          const obj = PapDOM.VectorObject.create({
            x: 0,
            y: 0,
            path: PapDOM.Path.create({
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
            }),
          })

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
              { color: { r: 255, g: 255, b: 0, a: 1 }, position: 0 },
              { color: { r: 0, g: 255, b: 255, a: 1 }, position: 1 },
            ],
          }

          vector.objects.push(obj)
        }

        vector.filters.push(...[])

        filter.filters.push(
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
          //   filterId: '@paplico/filters/noise',
          //   visible: false,
          //   settings: {
          //     ...engine.toolRegistry.getFilterInstance(
          //       '@paplico/filters/noise'
          //     )!.initialConfig,
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
          //   visible: true,
          //   opacity: 1,
          //   settings: {
          //     ...engine.toolRegistry.getFilterInstance(
          //       '@paplico/filters/zoom-blur'
          //     )!.initialConfig,
          //   },
          // }),
          // PapDOM.Filter.create({
          //   filterId: '@paplico/filters/kawase-blur',
          //   visible: true,
          //   opacity: 0.5,
          //   settings: engine.toolRegistry.getFilterInstance(
          //     '@paplico/filters/kawase-blur'
          //   )!.initialConfig,
          // }),
          // PapDOM.Filter.create<PapFilters.UVReplaceFilter>({
          //   filterId: '@paplico/filters/uvreplace',
          //   visible: false,
          //   settings: {
          //     ...(engine.toolRegistry.getFilterInstance(
          //       '@paplico/filters/uvreplace'
          //     )!.initialConfig as any),
          //     replacement: 'delta',
          //     replaceMapLayerUid: displacement.uid,
          //     movementPx: [10, 0],
          //   },
          // }),
          // PapDOM.Filter.create({
          //   filterId: '@paplico/filters/kawase-blur',
          //   visible: true,
          //   settings: engine.toolRegistry.getFilterInstance(
          //     '@paplico/filters/kawase-blur'
          //   )!.initialConfig,
          // })
          // PapDOM.Filter.create({
          //   filterId: '@paplico/filters/gradient-map',
          //   visible: true,
          //   settings: engine.toolRegistry.getFilterInstance(
          //     '@paplico/filters/gradient-map'
          //   )!.initialConfig,
          // }),
          PapDOM.Filter.create({
            filterId: '@paplico/filters/hue-shift',
            visible: true,
            settings: {
              ...engine.toolRegistry.getFilterInstance(
                '@paplico/filters/hue-shift'
              )!.initialConfig,
              shift: 0.5,
            },
          }),
          PapDOM.Filter.create({
            filterId: '@paplico/filters/tilt-shift',
            visible: true,
            settings: {
              ...engine.toolRegistry.getFilterInstance(
                '@paplico/filters/tilt-shift'
              )!.initialConfig,
              shift: 0.5,
            },
          }),
          ...[]
        )

        document.addLayer(displacement)
        document.addLayer(bgLayer)
        document.addLayer(vector, { aboveLayerId: bgLayer.uid })
        document.addLayer(raster)

        document.addLayer(square)
        document.addLayer(strokes)

        document.addLayer(filter)

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

        controlRef.current = {
          rerender: () => engine.render(document, strategy),
          rerenderWithoutCache: () => {
            if (strategy instanceof RenderStrategies.DifferenceRender) {
              strategy.clearCache()
              // PapBrushes.ScatterBrush.clearCache()
            }

            engine.render(document, strategy)
          },
          toggleFilters: () => {
            filter.filters.forEach((filter) => {
              filter.visible = !filter.visible

              console.log(
                `${filter.visible ? 'ENABLED' : 'DISABLED'}: ${filter.filterId}`
              )
            })
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
            <Button
              kind="normal"
              onClick={() => controlRef.current!.rerender()}
            >
              再描画
            </Button>
            <Button
              kind="normal"
              onClick={() => controlRef.current!.rerenderWithoutCache()}
            >
              再描画(キャッシュなし)
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
              /* width: 400px;
              height: 400px; */
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
