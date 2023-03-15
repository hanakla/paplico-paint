import { VectorObject, VectorPath } from '@/Document'
import { VectorLayer } from '@/Document/LayerEntity'
import { VectorStrokeSetting } from '@/Document/LayerEntity/VectorStrokeSetting'
import { AbortError } from '@/Errors'
import { UIStroke } from '@/UI/UIStroke'
import { AtomicResource } from '@/utils/AtomicResource'
import { saveAndRestoreCanvas, setCanvasSize } from '@/utils/canvas'
import { deepClone } from '@/utils/object'
import { OrthographicCamera, WebGLRenderer } from 'three'
import { BrushRegistry } from './BrushRegistry'
import { createCanvas } from './CanvasFactory'
import { RenderCycleLogger } from './RenderCycleLogger'
import { Viewport } from './types'
import {
  addPoint2D,
  calcVectorBoundingBox,
  mapPoints,
  multiplyPoint2D,
  vectorTransformToMatrix,
} from './VectorUtils'

export class Renderer {
  protected atomicThreeRenderer: AtomicResource<WebGLRenderer>
  protected brushRegistry: BrushRegistry
  protected camera: OrthographicCamera

  constructor(options: { brushRegistry: BrushRegistry }) {
    this.brushRegistry = options.brushRegistry

    const renderer = new WebGLRenderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      canvas: createCanvas() as HTMLCanvasElement,
    })
    renderer.setClearColor(0xffffff, 0)
    this.atomicThreeRenderer = new AtomicResource(renderer)

    this.camera = new OrthographicCamera(0, 0, 0, 0, 0, 1000)
  }

  public dispose() {
    this.atomicThreeRenderer.enjureForce().dispose()
  }

  public async renderVectorLayer(
    dest: HTMLCanvasElement,
    layer: VectorLayer,
    options: {
      viewport: Viewport
      abort?: AbortSignal
      logger: RenderCycleLogger
    }
  ) {
    setCanvasSize(dest, options.viewport)
    const dstctx = dest.getContext('2d')!

    for (const obj of layer.objects) {
      if (obj.type === 'vectorGroup') continue
      if (!obj.visible) continue

      await saveAndRestoreCanvas(dstctx, async () => {
        dstctx.globalCompositeOperation = 'source-over'

        // if (o.fill) {
        dstctx.transform(...vectorTransformToMatrix(obj))
        dstctx.beginPath()

        const [start] = obj.path.points
        dstctx.moveTo(start.x, start.y)

        mapPoints(
          obj.path.points,
          (point, prev) => {
            dstctx.bezierCurveTo(
              prev!.out?.x ?? prev!.x,
              prev!.out?.y ?? prev!.y,
              point.in?.x ?? point.x,
              point.in?.y ?? point.y,
              point.x,
              point.y
            )
          },
          { startOffset: 1 }
        )
        // }

        if (obj.path.closed) dstctx.closePath()

        for (const ap of obj.appearances) {
          if (ap.kind === 'fill') {
            switch (ap.fill.type) {
              case 'fill': {
                const {
                  color: { r, g, b },
                  opacity,
                } = ap.fill

                dstctx.globalAlpha = 1
                dstctx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${
                  b * 255
                }, ${opacity})`
                dstctx.fill()
                break
              }
              case 'linear-gradient': {
                const { colorStops: colorPoints, opacity, start, end } = ap.fill
                const { width, height, left, top } = calcVectorBoundingBox(obj)

                // const width = right - left
                // const height = bottom - top
                const centerX = left + width / 2
                const centerY = top + height / 2

                const gradient = dstctx.createLinearGradient(
                  centerX + start.x,
                  centerY + start.y,
                  centerX + end.x,
                  centerY + end.y
                )

                for (const {
                  position,
                  color: { r, g, b, a },
                } of colorPoints) {
                  gradient.addColorStop(
                    position,
                    `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a}`
                  )
                }

                dstctx.globalAlpha = opacity
                dstctx.fillStyle = gradient
                dstctx.fill()
                break
              }
            }
          } else if (ap.kind === 'stroke') {
            const brush = this.brushRegistry.getInstance(ap.stroke.brushId)

            if (brush == null) {
              throw new Error(`Unregistered brush ${ap.stroke.brushId}`)
            }

            await this.renderStroke(dest, obj.path, ap.stroke, {
              abort: options.abort,
              transform: {
                position: addPoint2D(layer.transform.position, obj.position),
                scale: multiplyPoint2D(layer.transform.scale, obj.scale),
                rotation: layer.transform.rotate + obj.rotate,
              },
              logger: options.logger,
            })
          }
        }
      })

      dstctx.resetTransform()
    }
  }

  protected async renderPath() {}

  public async renderVectorObject(dest: HTMLCanvasElement, path: VectorPath) {
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
      transform,
      abort,
      logger,
    }: {
      transform: {
        position: { x: number; y: number }
        scale: { x: number; y: number }
        rotation: number
      }
      abort?: AbortSignal
      logger: RenderCycleLogger
    }
  ) {
    const brush = this.brushRegistry.getInstance(strokeSetting.brushId)

    if (!brush) throw new Error(`Unregistered brush ${strokeSetting.brushId}`)

    const renderer = await this.atomicThreeRenderer.enjure()
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
          if (abort?.aborted) throw new AbortError()
        },
        context: dstctx,
        threeRenderer: renderer,
        threeCamera: this.camera,
        hintInput: null,
        brushSetting: deepClone(strokeSetting),
        path: [path],
        destSize: { width: dest.width, height: dest.height },
        transform: {
          translate: { x: transform.position.x, y: transform.position.y },
          scale: { x: transform.scale.x, y: transform.scale.y },
          rotate: transform.rotation,
        },
        logger,
      })
    } finally {
      this.atomicThreeRenderer.release(renderer)
    }

    // const [start, ...points] = path.points

    // dstctx.strokeStyle = '#000'
    // dstctx.lineWidth = 2

    // dstctx.beginPath()
    // dstctx.moveTo(start.x, start.y)
    // for (const point of points) dstctx.lineTo(point.x, point.y)
    // dstctx.stroke()
  }
}
