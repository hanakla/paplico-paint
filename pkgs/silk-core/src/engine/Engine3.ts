import * as THREE from 'three'
import mitt, { Emitter } from 'mitt'
import getBound from 'svg-path-bounds'

import { Brush, ScatterBrush } from '../Brushes'
import { Document, LayerTypes, VectorLayer } from '../SilkDOM'
import { BloomFilter } from '../Filters/Bloom'
import { ChromaticAberrationFilter } from '../Filters/ChromaticAberration'
import { GaussBlurFilter } from '../Filters/GaussBlur'
import { assign, AtomicResource, deepClone } from '../utils'
import { CurrentBrushSetting as _CurrentBrushSetting } from './CurrentBrushSetting'
import { IRenderStrategy } from './RenderStrategy/IRenderStrategy'
import { ToolRegistry } from './Engine3_ToolRegistry'
import { Stroke } from './Stroke'
import { PlainInk } from './Inks/PlainInk'
import WebGLContext from './WebGLContext'
import { IFilter } from './IFilter'
import { Session } from './Engine3_Sessions'
import { CompositeMode } from 'SilkDOM/IRenderable'
import { FullRender } from './RenderStrategy/FullRender'
import { createContext2D } from './Engine3_CanvasFactory'
import { BrushSetting } from 'Value'
import { IBrush } from './IBrush'
import { IInk } from './Inks/IInk'

type EngineEvents = {
  rerender: void
  activeLayerChanged: void
}

export declare namespace SilkEngine3 {
  export type RenderSetting = {
    disableAllFilters: boolean
    updateThumbnail: boolean
  }
}

export class SilkEngine3 {
  public static async create({ canvas }: { canvas: HTMLCanvasElement }) {
    const silk = new SilkEngine3({ canvas })

    await Promise.all([
      silk.toolRegistry.registerBrush(Brush),
      silk.toolRegistry.registerBrush(ScatterBrush),
      silk.toolRegistry.registerFilter(BloomFilter),
      silk.toolRegistry.registerFilter(GaussBlurFilter),
      silk.toolRegistry.registerFilter(ChromaticAberrationFilter),
    ])

    return silk
  }

  protected canvas: HTMLCanvasElement
  protected canvasCtx: CanvasRenderingContext2D

  // public readonly canvasHandler: CanvasHandler
  // public __dbg_bufferCtx: CanvasRenderingContext2D
  // protected strokeCanvasCtx: CanvasRenderingContext2D
  // protected strokeCompCtx: CanvasRenderingContext2D
  // protected strokingPreviewCtx: CanvasRenderingContext2D
  // protected thumbnailCanvas: HTMLCanvasElement
  // protected thumbnailCtx: CanvasRenderingContext2D
  // protected gl: WebGLContext
  protected atomicRender = new AtomicResource({ __render: true })
  protected atomicStrokeRender = new AtomicResource({
    __strokeToken: true,
  })
  protected atomicBufferCtx: AtomicResource<CanvasRenderingContext2D>
  // protected atomicRerender: AtomicResource<any>

  // public readonly previews: Map<string, string> = new Map()

  // protected document: Document | null = null
  // protected _currentBrush: IBrush = new Brush()
  // protected currentInk: IInk = new RandomInk()
  // protected _activeLayer: LayerTypes | null = null
  // protected _brushSetting: _CurrentBrushSetting = {
  //   brushId: Brush.id,
  //   weight: 1,
  //   color: { r: 0, g: 0, b: 0 },
  //   opacity: 1,
  // }
  // protected _pencilMode: 'none' | 'draw' | 'erase' = 'draw'
  // protected blushPromise: Promise<void> | null = null
  // protected _renderSetting: _RenderSetting = {
  //   disableAllFilters: false,
  //   updateThumbnail: true,
  // }

  // protected lastRenderedAt: WeakMap<LayerTypes, number> = new WeakMap()

  // protected vectorBitmapCache = new WeakMap<VectorLayer, any>()
  // protected vectorLayerLastRenderTimes = new WeakMap<VectorLayer, number>()

  private gl: WebGLContext
  protected atomicThreeRenderer: AtomicResource<THREE.WebGLRenderer>
  // private renderer: THREE.WebGLRenderer
  private camera: THREE.OrthographicCamera
  // private scene: THREE.Scene

  protected sessions: Session[] = []

  protected mitt: Emitter<EngineEvents>
  public on: Emitter<EngineEvents>['on']
  public off: Emitter<EngineEvents>['off']

  public toolRegistry: ToolRegistry

  public static layerBitmapCache: WeakMap<
    Document,
    { [layerId: string]: any }
  > = new WeakMap()

  protected constructor({ canvas }: { canvas: HTMLCanvasElement }) {
    this.canvas = canvas
    this.canvasCtx = canvas.getContext('2d')!

    this.mitt = mitt()
    this.on = this.mitt.on.bind(this.mitt)
    this.off = this.mitt.off.bind(this.mitt)

    const buffer = document.createElement('canvas')
    this.atomicBufferCtx = new AtomicResource(buffer.getContext('2d')!)

    this.gl = new WebGLContext(1, 1)
    this.toolRegistry = new ToolRegistry(this)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    })
    renderer.setClearColor(0x000000, 0)

    this.atomicThreeRenderer = new AtomicResource(renderer)

    this.camera = new THREE.OrthographicCamera(0, 0, 0, 0, 0, 1000)
    // this.scene = new THREE.Scene()

    document.body.appendChild(renderer.domElement)
  }

  public createSession(document: Document) {
    const session = new Session(document)

    this.sessions.push(session)
    session.on('disposed', () => {
      this.sessions.filter((s) => s !== session)
    })

    return session
  }

  public setCachedBitmap(document: Document, layerId: string) {
    const caches = SilkEngine3.layerBitmapCache.get(document) ?? {}
    caches[layerId] = {}
    return SilkEngine3.layerBitmapCache.set(document, caches)
  }

  public getCachedBitmap(document: Document, layerId: string) {
    return SilkEngine3.layerBitmapCache.get(document)?.[layerId]
  }

  public async render(document: Document, strategy: IRenderStrategy) {
    const lock = await this.atomicRender.enjure({ owner: this })
    const renderer = await this.atomicThreeRenderer.enjure({ owner: this })

    try {
      assign(this.canvasCtx.canvas, {
        width: document.width,
        height: document.height,
      })

      renderer.setSize(document.width, document.height)
      renderer.setClearColor(0x000000, 0)
      renderer.clear()

      this.camera.left = -document.width / 2.0
      this.camera.right = document.width / 2.0
      this.camera.top = document.height / 2.0
      this.camera.bottom = -document.height / 2.0
      this.camera.updateProjectionMatrix()

      await strategy.render(this, document, this.canvasCtx)

      this.mitt.emit('rerender')
    } finally {
      this.atomicThreeRenderer.release(renderer)
      this.atomicRender.release(lock)
    }
  }

  public async renderAndExport(
    document: Document,
    strategy: IRenderStrategy = new FullRender()
  ) {
    const lock = await this.atomicRender.enjure({ owner: this })
    const exportCtx = createContext2D()

    try {
      assign(exportCtx.canvas, {
        width: document.width,
        height: document.height,
      })

      await strategy.render(this, document, exportCtx)

      return {
        export: (mimeType: string, quality?: number) => {
          return new Promise<Blob>((resolve, reject) => {
            exportCtx.canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob)
                else reject(new Error('Failed to export canvas'))
              },
              mimeType,
              quality
            )
          })
        },
      }
    } finally {
      this.atomicRender.release(lock)
    }
  }

  public async renderStroke(
    brush: IBrush,
    brushSetting: BrushSetting,
    ink: IInk,
    stroke: Stroke,
    destCtx: CanvasRenderingContext2D
  ) {
    if (stroke.points.length < 2) return
    const lock = await this.atomicStrokeRender.enjure({ owner: this })
    const renderer = await this.atomicThreeRenderer.enjure({ owner: this })

    renderer.setSize(destCtx.canvas.width, destCtx.canvas.height)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()

    this.camera.left = -destCtx.canvas.width / 2.0
    this.camera.right = destCtx.canvas.width / 2.0
    this.camera.top = destCtx.canvas.height / 2.0
    this.camera.bottom = -destCtx.canvas.height / 2.0
    this.camera.updateProjectionMatrix()

    try {
      brush.render({
        brushSetting: brushSetting,
        context: destCtx,
        threeRenderer: renderer,
        threeCamera: this.camera,
        ink: ink,
        stroke,
        destSize: {
          width: destCtx.canvas.width,
          height: destCtx.canvas.height,
        },
      })
    } finally {
      this.atomicThreeRenderer.release(renderer)
      this.atomicStrokeRender.release(lock)
    }
  }

  public async renderVectorLayer(document: Document, layer: VectorLayer) {
    const { width, height } = document
    const bufferCtx = await this.atomicBufferCtx.enjure({ owner: this })

    try {
      const bitmap = new Uint8ClampedArray(width * height * 4)

      assign(bufferCtx.canvas, { width, height })
      bufferCtx.clearRect(0, 0, width, height)

      for (const object of layer.objects) {
        bufferCtx.save()
        bufferCtx.globalCompositeOperation = 'source-over'
        bufferCtx.translate(object.x, object.y)

        if (object.fill) {
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
              bufferCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`
              bufferCtx.fill()
              break
            }
            case 'linear-gradient': {
              const { colorPoints, opacity, start, end } = object.fill
              // const bbox = getBound(object.path.svgPath)
              const [left, top, right, bottom] = getBound(object.path.svgPath)
              // console.log(bbox)

              const width = right - left
              const height = bottom - top
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
                gradient.addColorStop(position, `rgba(${r}, ${g}, ${b}, ${a}`)
              }

              bufferCtx.globalAlpha = opacity
              bufferCtx.fillStyle = gradient
              bufferCtx.fill()
              break
            }
          }
        }

        if (object.brush) {
          const brush = this.toolRegistry.getBrushInstance(
            object.brush.brushId
          )!

          if (brush == null)
            throw new Error(`Unregistered brush ${object.brush.brushId}`)

          const stroke = Stroke.fromPath(object.path)

          await this.renderStroke(
            brush,
            object.brush,
            new PlainInk(),
            stroke,
            bufferCtx
          )
        }

        bufferCtx.restore()
      }

      const data = bufferCtx.getImageData(0, 0, width, height).data
      bitmap.set(data)

      return bitmap
    } finally {
      this.atomicBufferCtx.release(bufferCtx)
    }
  }

  public async applyFilter(
    source: CanvasRenderingContext2D,
    dest: CanvasRenderingContext2D,
    filter: IFilter,
    options: {
      size: {
        width: number
        height: number
      }
      filterSettings: Record<string, any>
    }
  ) {
    source.save()
    dest.save()

    try {
      filter.render({
        gl: this.gl,
        source: source.canvas,
        dest: dest.canvas,
        size: options.size,
        settings: deepClone(options.filterSettings),
      })
    } finally {
      dest.restore()
      source.restore()
    }
  }

  public async compositeLayers(
    layerImage: CanvasRenderingContext2D,
    compositeTo: CanvasRenderingContext2D,
    {
      mode,
      opacity,
    }: {
      mode: CompositeMode
      /** 0 to 100 */
      opacity: number
    }
  ) {
    compositeTo.save()

    compositeTo.globalCompositeOperation =
      mode === 'normal' ? 'source-over' : mode
    compositeTo.globalAlpha = Math.max(0, Math.min(opacity / 100, 1))
    compositeTo.drawImage(layerImage.canvas, 0, 0)

    compositeTo.restore()
  }
}
