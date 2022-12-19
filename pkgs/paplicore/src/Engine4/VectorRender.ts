import { VectorLayer } from '../DOM'
import { VectorLayer as NewVectorLayer } from '../Document/LayerEntity'
import { VectorPath } from '../Document/LayerEntity/VectorPath'
import { BrushSetting } from '../Value'
import { IInk } from '../Inks/IInk'
import { BrushContext } from '../engine/IBrush'
import {
  logGroup,
  logGroupEnd,
  logTime,
  logTimeEnd,
  timeSumming,
} from '../DebugHelper'
import { VectorBrushSetting } from '../Document/LayerEntity/VectorBrushSetting'
import { AtomicResource } from '../AtomicResource'
import { ToolRegistry } from './ToolRegistry'
import { WebGLContext } from './WebGLContext'
import { createCanvas, createContext2D } from '../Engine3_CanvasFactory'
import { OrthographicCamera, WebGLRenderer } from 'three'
import { setCanvasSizeIfDifferent } from '../utils'

export class VectorRender {
  private gl: WebGLContext

  private atomicStrokeRender = new AtomicResource({})
  protected atomicThreeRenderer: AtomicResource<WebGLRenderer>

  private camera: OrthographicCamera

  protected atomicBufferCtx: AtomicResource<CanvasRenderingContext2D>

  constructor(private toolRegistry: ToolRegistry) {
    this.gl = new WebGLContext()

    const renderer = new WebGLRenderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      canvas: createCanvas() as HTMLCanvasElement,
    })
    renderer.setClearColor(0xffffff, 0)

    this.camera = new OrthographicCamera(0, 0, 0, 0, 0, 1000)
    this.atomicThreeRenderer = new AtomicResource(renderer)

    const buffer = createContext2D()
    this.atomicBufferCtx = new AtomicResource(buffer!, 'buffer')
  }

  public render(
    node: NewVectorLayer,
    { target }: { target: CanvasRenderingContext2D }
  ) {
    for (const obj of node.objects) {
      if (obj.type === 'vectorObject') {
        if (obj.brush) {
          this.renderPath(
            obj.brush,
            obj,
            {
              translate: node.transform.position,
              rotate: node.transform.rotate,
              scale: node.transform.scale,
            },
            target,
            {
              hintInput: null,
            }
          )
        }
      } else if (obj.type === 'vectorGroup') {
        // this.render(obj, {target})
      }
    }
  }

  public async renderPath(
    brushSetting: VectorBrushSetting,
    path: VectorPath,
    transform: BrushContext['transform'],
    destCtx: CanvasRenderingContext2D,
    {
      hintInput,
    }: {
      hintInput?: CanvasImageSource | null
    }
  ) {
    if (path.points.length < 1) return

    const perf_clonePath = timeSumming('clonePath', '👥')
    const perf_freezePath = timeSumming('freezePath', '🧊')

    const lock = await this.atomicStrokeRender.enjure({ owner: this })
    const brush = await this.toolRegistry.getBrushInstance(
      brushSetting.brushId,
      this.gl
    )

    if (!brush) {
      throw new Error(
        `Failed to render stroke: Brush not found ${brushSetting.brushId}`
      )
    }

    const renderer = await this.atomicThreeRenderer.enjure({ owner: this })

    renderer.setSize(destCtx.canvas.width, destCtx.canvas.height, false)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()

    this.camera.left = -destCtx.canvas.width / 2.0
    this.camera.right = destCtx.canvas.width / 2.0
    this.camera.top = destCtx.canvas.height / 2.0
    this.camera.bottom = -destCtx.canvas.height / 2.0
    this.camera.updateProjectionMatrix()

    perf_clonePath.time()
    path = path.clone()
    perf_clonePath.timeEnd({ points: path.points.length })

    perf_freezePath.time()
    path.freeze()
    perf_freezePath.timeEnd({ points: path.points.length })

    destCtx.save()
    try {
      logTime(`essential stroke render`)

      brush.render({
        brushSetting: brushSetting,
        context: destCtx,
        threeRenderer: renderer,
        threeCamera: this.camera,
        gl: this.gl,
        // ink: ink,
        path,
        transform,
        hintInput: hintInput ?? null,
        destSize: {
          width: destCtx.canvas.width,
          height: destCtx.canvas.height,
        },
      })

      logTimeEnd('essential stroke render')
    } catch (e) {
      throw e
    } finally {
      perf_clonePath.log()
      perf_freezePath.log()

      destCtx.restore()

      this.atomicThreeRenderer.release(renderer)
      this.atomicStrokeRender.release(lock)
    }
  }

  public renderVectorLayer(
    document: Document,
    layer: VectorLayer
  ): Promise<Uint8ClampedArray>
  public renderVectorLayer(
    document: Document,
    layer: VectorLayer,
    dest: CanvasRenderingContext2D
  ): Promise<void>

  public async renderVectorLayer(
    document: Document,
    layer: VectorLayer,
    dest?: CanvasRenderingContext2D
  ): Promise<Uint8ClampedArray | void> {
    logGroup(`renderVectorLayer(): ${layer.uid}`)

    const { width, height } = document
    logTime('ensureBuffer for vector')
    const bufferCtx = await this.atomicBufferCtx.enjure({ owner: this })
    logTimeEnd('ensureBuffer for vector')

    try {
      setCanvasSizeIfDifferent(bufferCtx.canvas, width, height)
      bufferCtx.clearRect(0, 0, width, height)

      for (const object of [...layer.objects].reverse()) {
        if (!object.visible) continue

        bufferCtx.save()

        bufferCtx.globalCompositeOperation = 'source-over'

        if (object.fill) {
          bufferCtx.transform(...object.matrix)
          bufferCtx.beginPath()

          const start = object.path.points[0]
          bufferCtx.moveTo(start.x, start.y)

          object.path.mapPoints(
            (point, prev) => {
              bufferCtx.bezierCurveTo(
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

          if (object.path.closed) bufferCtx.closePath()

          switch (object.fill.type) {
            case 'fill': {
              const {
                color: { r, g, b },
                opacity,
              } = object.fill

              bufferCtx.globalAlpha = 1
              bufferCtx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${
                b * 255
              }, ${opacity})`
              bufferCtx.fill()
              break
            }
            case 'linear-gradient': {
              const {
                colorStops: colorPoints,
                opacity,
                start,
                end,
              } = object.fill
              const { width, height, left, top } = object.getBoundingBox()

              // const width = right - left
              // const height = bottom - top
              const centerX = left + width / 2
              const centerY = top + height / 2

              const gradient = bufferCtx.createLinearGradient(
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

              bufferCtx.globalAlpha = opacity
              bufferCtx.fillStyle = gradient
              bufferCtx.fill()
              break
            }
          }

          bufferCtx.resetTransform()
        }

        if (object.brush) {
          const brush = this.toolRegistry.getBrushInstance(
            object.brush.brushId,
            this.gl
          )!

          if (brush == null)
            throw new Error(`Unregistered brush ${object.brush.brushId}`)

          logTime('Engine.renderPath')

          await this.renderPath(
            object.brush,
            // new PlainInk(),
            object.path,
            {
              rotate: object.rotate,
              scale: { x: object.scale[0], y: object.scale[1] },
              translate: { x: object.x, y: object.y },
            },
            bufferCtx,
            { hintInput: bufferCtx.canvas }
          )

          logTimeEnd('Engine.renderPath')
        }

        bufferCtx.restore()
      }

      if (dest) {
        dest.drawImage(bufferCtx.canvas, 0, 0)
      } else {
        return bufferCtx.getImageData(0, 0, width, height).data
      }
    } finally {
      logGroupEnd()
      this.atomicBufferCtx.release(bufferCtx)
    }
  }
}
