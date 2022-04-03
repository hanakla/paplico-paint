import * as THREE from 'three'
import mitt, { Emitter } from 'mitt'
import getBound from 'svg-path-bounds'

import { Brush } from '../Brushes'
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
import { createCanvas } from './Engine3_CanvasFactory'

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
  protected atomicRender = new AtomicResource<any>({})
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

  public gl: WebGLContext
  public renderer: THREE.WebGLRenderer
  public camera: THREE.OrthographicCamera
  public scene: THREE.Scene

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

    // this.renderer = new THREE.WebGLRenderer({
    //   alpha: true,
    //   premultipliedAlpha: true,
    //   antialias: true,
    //   preserveDrawingBuffer: true,
    // })

    // this.camera = new THREE.OrthographicCamera(0, 100, 0, 100, 0.001, 10000)
    // this.scene = new THREE.Scene()
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
    const lock = await this.atomicRender.enjure()

    try {
      assign(this.canvasCtx.canvas, {
        width: document.width,
        height: document.height,
      })

      // this.renderer.setSize(document.width, document.height)
      // this.renderer.setClearAlpha(1)

      // this.camera.left = -document.width / 2.0
      // this.camera.right = document.width / 2.0
      // this.camera.top = document.height / 2.0
      // this.camera.bottom = -document.height / 2.0
      // this.camera.updateProjectionMatrix()

      await strategy.render(this, document, this.canvasCtx)

      this.mitt.emit('rerender')
    } finally {
      this.atomicRender.release(lock)
    }
  }

  public async renderAndExport(
    document: Document,
    strategy: IRenderStrategy = new FullRender()
  ) {
    const lock = await this.atomicRender.enjure()
    const exportCtx = createCanvas()

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
    session: Session,
    stroke: Stroke,
    destCtx: CanvasRenderingContext2D
  ) {
    const lock = await this.atomicRender.enjure()

    try {
      session.currentBursh.render({
        brushSetting: session.brushSetting,
        context: destCtx,
        ink: session.currentInk,
        stroke,
      })
    } finally {
      this.atomicRender.release(lock)
    }
  }

  public async renderVectorLayer(document: Document, layer: VectorLayer) {
    const { width, height } = document
    const bufferCtx = await this.atomicBufferCtx.enjure()

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
        const brush = this.toolRegistry.getBrushInstance(object.brush.brushId)!

        if (brush == null)
          throw new Error(`Unregistered brush ${object.brush.brushId}`)

        const stroke = Stroke.fromPath(object.path)

        brush.render({
          context: bufferCtx,
          stroke,
          ink: new PlainInk(),
          brushSetting: object.brush,
        })
      }

      bufferCtx.restore()
    }

    const data = bufferCtx.getImageData(0, 0, width, height).data
    bitmap.set(data)

    this.atomicBufferCtx.release(bufferCtx)
    return bitmap
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
