import { VectorObject, VectorPath } from '@/Document'
import { VectorLayer } from '@/Document/LayerEntity'
import { InkSetting } from '@/Document/LayerEntity/InkSetting'
import { VectorStrokeSetting } from '@/Document/LayerEntity/VectorStrokeSetting'
import { PaplicoAbortError } from '@/Errors'
import { UIStroke } from '@/UI/UIStroke'
import { AtomicResource } from '@/utils/AtomicResource'
import {
  clearCanvas,
  saveAndRestoreCanvas,
  setCanvasSize,
} from '@/utils/canvas'
import { deepClone } from '@/utils/object'
import { OrthographicCamera, WebGLRenderer } from 'three'
import { BrushRegistry } from './Registry/BrushRegistry'
import { createCanvas, createContext2D } from './CanvasFactory'
import { InkRegistry } from './Registry/InkRegistry'
import { RenderCycleLogger } from './RenderCycleLogger'
import { RenderPhase, Viewport } from './types'
import {
  addPoint2D,
  calcVectorBoundingBox,
  mapPoints,
  multiplyPoint2D,
  vectorTransformToMatrix,
} from './VectorUtils'
import { AppearanceRegistry } from './Registry/AppearanceRegistry'

export class VectorRenderer {
  protected brushRegistry: BrushRegistry
  protected inkRegistry: InkRegistry
  protected filterRegistry: AppearanceRegistry

  protected glRendererResource: AtomicResource<WebGLRenderer>

  protected camera: OrthographicCamera

  constructor(options: {
    brushRegistry: BrushRegistry
    inkRegistry: InkRegistry
    appearanceRegistry: AppearanceRegistry
    glRenderer: AtomicResource<WebGLRenderer>
  }) {
    this.brushRegistry = options.brushRegistry
    this.inkRegistry = options.inkRegistry
    this.filterRegistry = options.appearanceRegistry

    this.glRendererResource = options.glRenderer
    this.camera = new OrthographicCamera(0, 0, 0, 0, 0, 1000)
  }

  public dispose() {
    this.glRendererResource.ensureForce().dispose()
  }

  public async renderVectorLayer(
    output: HTMLCanvasElement,
    layer: VectorLayer,
    options: {
      viewport: Viewport
      pixelRatio: number
      abort?: AbortSignal
      logger: RenderCycleLogger
      phase: RenderPhase
    },
  ): Promise<void> {
    const { logger } = options

    setCanvasSize(output, options.viewport)
    const outcx = output.getContext('2d')!

    for (const obj of layer.objects) {
      if (obj.type === 'vectorGroup') continue
      if (!obj.visible) continue

      await saveAndRestoreCanvas(outcx, async () => {
        outcx.globalCompositeOperation = 'source-over'

        // if (o.fill) {
        outcx.transform(...vectorTransformToMatrix(obj))
        outcx.beginPath()

        const [start] = obj.path.points
        outcx.moveTo(start.x, start.y)

        mapPoints(
          obj.path.points,
          (point, prev) => {
            outcx.bezierCurveTo(
              point.begin?.x ?? prev!.x,
              point.begin?.y ?? prev!.y,
              point.end?.x ?? point.x,
              point.end?.y ?? point.y,
              point.x,
              point.y,
            )
          },
          { startOffset: 1 },
        )
        // }

        if (obj.path.closed) outcx.closePath()

        for (const ap of obj.filters) {
          if (ap.kind === 'fill') {
            switch (ap.fill.type) {
              case 'fill': {
                const {
                  color: { r, g, b },
                  opacity,
                } = ap.fill

                outcx.globalAlpha = 1
                outcx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${
                  b * 255
                }, ${opacity})`
                outcx.fill()
                break
              }
              case 'linear-gradient': {
                const { colorStops: colorPoints, opacity, start, end } = ap.fill
                const { width, height, left, top } = calcVectorBoundingBox(obj)

                // const width = right - left
                // const height = bottom - top
                const centerX = left + width / 2
                const centerY = top + height / 2

                const gradient = outcx.createLinearGradient(
                  centerX + start.x,
                  centerY + start.y,
                  centerX + end.x,
                  centerY + end.y,
                )

                for (const {
                  position,
                  color: { r, g, b, a },
                } of colorPoints) {
                  gradient.addColorStop(
                    position,
                    `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a}`,
                  )
                }

                outcx.globalAlpha = opacity
                outcx.fillStyle = gradient
                outcx.fill()
                break
              }
            }
          } else if (ap.kind === 'stroke') {
            const brush = this.brushRegistry.getInstance(ap.stroke.brushId)

            if (brush == null) {
              throw new Error(`Unregistered brush ${ap.stroke.brushId}`)
            }

            await this.renderStroke(output, obj.path, ap.stroke, {
              abort: options.abort,
              inkSetting: ap.ink,
              transform: {
                position: addPoint2D(
                  layer.transform.position,
                  obj.transform.position,
                ),
                scale: multiplyPoint2D(
                  layer.transform.scale,
                  obj.transform.scale,
                ),
                rotation: layer.transform.rotate + obj.transform.rotate,
              },
              phase: options.phase,
              logger: options.logger,
            })
          } else if (ap.kind === 'external') {
            // console.log({ ap })
            // const nextImage = await this.postProcess(output, ap, {
            //   abort: options.abort,
            //   filterDstCx,
            //   viewport: options.viewport,
            //   pixelRatio: options.pixelRatio,
            //   logger,
            //   phase: options.phase,
            // })

            if (nextImage == null) return

            outcx.drawImage(nextImage, 0, 0)
          }
        }
      })

      outcx.resetTransform()
    }
  }

  // protected async renderPath() {}

  public async renderVectorObject(
    dest: HTMLCanvasElement,
    path: VectorPath,
  ): Promise<void> {
    const dstctx = dest.getContext('2d')!

    // const brush = this.brushRegistry.getInstance('stroke')
    // if (!brush) return

    const [start, ...points] = path.points

    dstctx.strokeStyle = '#000'
    dstctx.lineWidth = 2

    dstctx.beginPath()
    dstctx.moveTo(start.x, start.y)
    for (const point of points) dstctx.lineTo(point.x, point.y)
    dstctx.stroke()
  }

  public async renderStroke(
    dest: HTMLCanvasElement,
    path: VectorPath,
    strokeSetting: VectorStrokeSetting,
    {
      inkSetting,
      transform,
      abort,
      phase,
      logger,
    }: {
      inkSetting: InkSetting
      transform: {
        position: { x: number; y: number }
        scale: { x: number; y: number }
        rotation: number
      }
      abort?: AbortSignal
      phase: RenderPhase
      logger: RenderCycleLogger
    },
  ): Promise<void> {
    const brush = this.brushRegistry.getInstance(strokeSetting.brushId)
    const ink = this.inkRegistry.getInstance(inkSetting.inkId)

    if (!brush) throw new Error(`Unregistered brush ${strokeSetting.brushId}`)
    if (!ink) throw new Error(`Unregistered ink ${inkSetting.inkId}`)

    const renderer = await this.glRendererResource.ensure()
    const dstctx = dest.getContext('2d')!
    const { width, height } = dest

    renderer.setSize(width, height, false)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()

    this.camera.left = -width / 2.0
    this.camera.right = width / 2.0
    this.camera.top = height / 2.0
    this.camera.bottom = -height / 2.0
    this.camera.updateProjectionMatrix()

    try {
      await brush.render({
        abort: abort ?? new AbortController().signal,
        abortIfNeeded: () => {
          if (abort?.aborted) throw new PaplicoAbortError()
        },
        destContext: dstctx,
        threeRenderer: renderer,
        threeCamera: this.camera,

        brushSetting: deepClone(strokeSetting),
        ink: ink.getInkGenerator({}),
        path: [path],
        destSize: { width: dest.width, height: dest.height },
        transform: {
          translate: { x: transform.position.x, y: transform.position.y },
          scale: { x: transform.scale.x, y: transform.scale.y },
          rotate: transform.rotation,
        },
        phase,
        logger,
      })
    } finally {
      this.glRendererResource.release(renderer)
    }
  }
}
