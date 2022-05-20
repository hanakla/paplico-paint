import * as THREE from 'three'
import mitt, { Emitter } from 'mitt'
import AggregateError from 'es-aggregate-error'

import { Brush, ScatterBrush } from '../Brushes'
import { Document, LayerTypes, Path, VectorLayer, VectorObject } from '../DOM'
import { setCanvasSize, debounce } from '../utils'
import { deepClone } from '../utils/object'
import { CurrentBrushSetting as _CurrentBrushSetting } from './CurrentBrushSetting'
import { IRenderStrategy } from './RenderStrategy/IRenderStrategy'
import { ToolRegistry } from './Engine3_ToolRegistry'
import { PlainInk } from '../Inks/PlainInk'
import { WebGLContext } from './WebGLContext'
import { IFilter } from './IFilter'
import { CompositeMode } from '../DOM/ILayer'
import { FullRender } from './RenderStrategy/FullRender'
import { createCanvas, createContext2D } from '../Engine3_CanvasFactory'
import { BrushSetting } from '../Value'
import { IInk } from '../Inks/IInk'
import { AtomicResource } from '../AtomicResource'

import { BloomFilter } from '../Filters/Bloom'
import { ChromaticAberrationFilter } from '../Filters/ChromaticAberration'
import { GaussBlurFilter } from '../Filters/GaussBlur'
import { GradientMapFilter } from '../Filters/GradientMap'
import { HalftoneFilter } from '../Filters/HalfTone'
import { GlitchJpegFilter } from '../Filters/GlitchJpeg'
import { NoiseFilter } from '../Filters/Noise'
import { BinarizationFilter } from '../Filters/Binarization'
import { LowResoFilter } from '../Filters/LowReso'
import { OutlineFilter } from '../Filters/Outline'
import { ZoomBlurFilter } from '../Filters/ZoomBlur'
import { KawaseBlurFilter } from '../Filters/KawaseBlur'
import { UVReplaceFilter } from '../Filters/UVReplace'
import { nanoid } from 'nanoid'
import {
  logGroup,
  logGroupCollapsed,
  logGroupEnd,
  logImage,
  logTime,
  logTimeEnd,
  timeSumming,
} from '../DebugHelper'
import { makeReadOnlyCanvas, saveAndRestoreCanvas } from '../utils/canvas'
import { BrushContext } from './IBrush'

type EngineEvents = {
  rerender: void
  renderError: AggregateError
  activeLayerChanged: void
}

export declare namespace PaplicoEngine {
  export type RenderSetting = {
    disableAllFilters: boolean
    updateThumbnail: boolean
  }
}

export class PaplicoEngine {
  public static async create({ canvas }: { canvas: HTMLCanvasElement }) {
    const engine = new PaplicoEngine({ canvas })

    await Promise.all([
      engine.toolRegistry.registerBrush(Brush),
      engine.toolRegistry.registerBrush(ScatterBrush),

      engine.toolRegistry.registerFilter(BloomFilter),
      engine.toolRegistry.registerFilter(GlitchJpegFilter),
      engine.toolRegistry.registerFilter(GaussBlurFilter),
      engine.toolRegistry.registerFilter(GradientMapFilter),
      engine.toolRegistry.registerFilter(ChromaticAberrationFilter),
      engine.toolRegistry.registerFilter(HalftoneFilter),
      engine.toolRegistry.registerFilter(NoiseFilter),
      engine.toolRegistry.registerFilter(BinarizationFilter),
      engine.toolRegistry.registerFilter(LowResoFilter),
      engine.toolRegistry.registerFilter(OutlineFilter),
      engine.toolRegistry.registerFilter(ZoomBlurFilter),
      engine.toolRegistry.registerFilter(KawaseBlurFilter),
      engine.toolRegistry.registerFilter(UVReplaceFilter),
    ])

    return engine
  }

  protected canvas: HTMLCanvasElement
  protected canvasCtx: CanvasRenderingContext2D
  protected atomicPreDestCtx: AtomicResource<CanvasRenderingContext2D>

  // public readonly canvasHandler: CanvasHandler
  // public __dbg_bufferCtx: CanvasRenderingContext2D
  // protected strokeCanvasCtx: CanvasRenderingContext2D
  // protected strokeCompCtx: CanvasRenderingContext2D
  // protected strokingPreviewCtx: CanvasRenderingContext2D
  // protected thumbnailCanvas: HTMLCanvasElement
  // protected thumbnailCtx: CanvasRenderingContext2D
  // protected gl: WebGLContext
  protected atomicRender = new AtomicResource({ __render: true }, 'render')
  protected atomicStrokeRender = new AtomicResource(
    {
      __strokeToken: true,
    },
    'stroke'
  )
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

  protected mitt: Emitter<EngineEvents>
  public on: Emitter<EngineEvents>['on']
  public off: Emitter<EngineEvents>['off']

  public toolRegistry: ToolRegistry

  // public static layerBitmapCache: WeakMap<
  //   Document,
  //   { [layerId: string]: any }
  // > = new WeakMap()

  protected constructor({ canvas }: { canvas: HTMLCanvasElement }) {
    this.canvas = canvas
    this.canvasCtx = canvas.getContext('2d', {
      // alpha: false,
      // colorSpace: 'display-p3',
    })!

    this.mitt = mitt()
    this.on = this.mitt.on.bind(this.mitt)
    this.off = this.mitt.off.bind(this.mitt)

    const buffer = createContext2D()
    this.atomicBufferCtx = new AtomicResource(buffer!, 'buffer')

    this.gl = new WebGLContext()
    this.toolRegistry = new ToolRegistry(this.gl)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      canvas: createCanvas() as HTMLCanvasElement,
    })
    renderer.setClearColor(0xffffff, 0)

    this.atomicThreeRenderer = new AtomicResource(renderer, 'threeRenderer')
    this.atomicPreDestCtx = new AtomicResource(createContext2D(), 'predest')

    this.camera = new THREE.OrthographicCamera(0, 0, 0, 0, 0, 1000)
    // this.scene = new THREE.Scene()

    // document.body.appendChild(renderer.domElement)
  }

  public dispose() {
    this.atomicRender.enjure({ owner: this })
    this.atomicStrokeRender.enjure({ owner: this })

    // Freeing memory for Safari

    this.atomicThreeRenderer.enjure({ owner: this }).then((renderer) => {
      setCanvasSize(renderer.domElement, 0, 0)
      renderer.dispose()
    })

    this.atomicBufferCtx.enjure().then((ctx) => {
      setCanvasSize(ctx.canvas, 0, 0)
    })

    this.atomicPreDestCtx.enjure().then((ctx) => {
      setCanvasSize(ctx.canvas, 0, 0)
    })
  }

  // public setCachedBitmap(document: Document, layerId: string) {
  //   const caches = PaplicoEngine.layerBitmapCache.get(document) ?? {}
  //   caches[layerId] = {}
  //   return PaplicoEngine.layerBitmapCache.set(document, caches)
  // }

  // public getCachedBitmap(document: Document, layerId: string) {
  //   return PaplicoEngine.layerBitmapCache.get(document)?.[layerId]
  // }

  public lazyRender = debounce(
    (document: Document, strategy: IRenderStrategy) => {
      return this.render(document, strategy, { lazy: true })
    },
    100
  )

  public async render(
    document: Document,
    strategy: IRenderStrategy,
    {
      target = this.canvasCtx,
      lazy = false,
    }: { target?: CanvasRenderingContext2D | null; lazy?: boolean } = {}
  ) {
    const errors: Error[] = []
    const rid = nanoid()
    const lock = await (lazy
      ? this.atomicRender.enjure({ owner: this })
      : this.atomicRender.ensureLazy({ owner: this, timeout: 100 }))
    if (!lock) return

    const renderer = await this.atomicThreeRenderer.enjure({ owner: this })
    const preDestCtx = await this.atomicPreDestCtx.enjure({ owner: this })

    logGroup(`render-time-${rid}`)
    logTime(`render-${rid}`)

    try {
      setCanvasSize(preDestCtx.canvas, document.width, document.height)

      saveAndRestoreCanvas(preDestCtx, (ctx) => {
        ctx.fillStyle = 'rgba(255,255,255,0.01)'
        // ctx.clearRect(0, 0, document.width, document.height)
        ctx.fillRect(0, 0, document.width, document.height)
      })

      renderer.setSize(document.width, document.height, false)
      renderer.setClearColor(0x000000, 0)
      renderer.clear()

      this.camera.left = -document.width / 2.0
      this.camera.right = document.width / 2.0
      this.camera.top = document.height / 2.0
      this.camera.bottom = -document.height / 2.0
      this.camera.updateProjectionMatrix()

      // After clear, release resource for rendering
      this.atomicThreeRenderer.release(renderer)

      logTime('Essential render')
      logGroupCollapsed('Start Strategy render')

      await strategy.render(this, document, preDestCtx)

      target && setCanvasSize(target.canvas, document.width, document.height)
      target?.clearRect(0, 0, document.width, document.height)
      target?.drawImage(
        preDestCtx.canvas,
        0,
        0,
        document.width,
        document.height
      )

      logGroupEnd()
      logTimeEnd('Essential render')

      if (errors.length > 0) {
        this.mitt.emit(
          'renderError',
          new AggregateError(errors, 'Caught errors in rendering process')
        )
      }

      if (target === this.canvasCtx) {
        this.mitt.emit('rerender')
      }
    } finally {
      logTimeEnd(`render-${rid}`)
      logGroupEnd()
      this.atomicThreeRenderer.isLocked &&
        this.atomicThreeRenderer.release(renderer)
      this.atomicPreDestCtx.release(preDestCtx)
      this.atomicRender.release(lock)
    }
  }

  public async renderAndExport(
    document: Document,
    strategy: IRenderStrategy = new FullRender()
  ) {
    const exportCtx = createContext2D()

    const lock = await this.atomicRender.enjure({ owner: this })
    const renderer = await this.atomicThreeRenderer.enjure({ owner: this })

    try {
      setCanvasSize(exportCtx.canvas, document.width, document.height)

      renderer.setSize(document.width, document.height, false)
      renderer.setClearColor(0x000000, 0)
      renderer.clear()

      this.camera.left = -document.width / 2.0
      this.camera.right = document.width / 2.0
      this.camera.top = document.height / 2.0
      this.camera.bottom = -document.height / 2.0
      this.camera.updateProjectionMatrix()

      // After clear, release resource for rendering
      this.atomicThreeRenderer.release(renderer)

      await strategy.render(this, document, exportCtx)

      return {
        export: (mimeType: string, quality?: number) => {
          return new Promise<Blob>(async (resolve, reject) => {
            const canvas = exportCtx.canvas as
              | HTMLCanvasElement
              | OffscreenCanvas

            if ('toBlob' in canvas) {
              canvas.toBlob(
                (blob) => {
                  if (blob) resolve(blob)
                  else reject(new Error('Failed to export canvas'))
                },
                mimeType,
                quality
              )
            } else {
              try {
                resolve(await canvas.convertToBlob({ type: mimeType, quality }))
              } catch (e) {
                reject(e)
              }
            }

            // Free memory for canvas
            setCanvasSize(exportCtx.canvas, 0, 0)
          })
        },
      }
    } finally {
      this.atomicThreeRenderer.isLocked &&
        this.atomicThreeRenderer.release(renderer)
      this.atomicRender.release(lock)
    }
  }

  public async renderPath(
    brushSetting: BrushSetting,
    ink: IInk,
    path: Path,
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
    const brush = this.toolRegistry.getBrushInstance(brushSetting.brushId)

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
        ink: ink,
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
      setCanvasSize(bufferCtx.canvas, width, height)
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
            object.brush.brushId
          )!

          if (brush == null)
            throw new Error(`Unregistered brush ${object.brush.brushId}`)

          logTime('Engine.renderPath')

          await this.renderPath(
            object.brush,
            new PlainInk(),
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

  public async applyFilter(
    source: CanvasRenderingContext2D,
    dest: CanvasRenderingContext2D,
    filter: IFilter,
    options: {
      handleLayerBitmapRequest: (
        layerUid: string
      ) => Promise<
        { missing: false; image: TexImageSource } | { missing: true }
      >
      layer: LayerTypes
      /** 0..1 */
      opacity: number
      size: {
        width: number
        height: number
      }
      filterSettings: Record<string, any>
    }
  ) {
    source.save()
    dest.save()

    const renderer = await this.atomicThreeRenderer.enjure({ owner: this })

    renderer.setSize(dest.canvas.width, dest.canvas.height, false)
    renderer.setClearColor(0xffffff, 0)
    renderer.clear()

    this.camera.left = -dest.canvas.width / 2.0
    this.camera.right = dest.canvas.width / 2.0
    this.camera.top = dest.canvas.height / 2.0
    this.camera.bottom = -dest.canvas.height / 2.0
    this.camera.updateProjectionMatrix()

    try {
      await filter.render({
        gl: this.gl,
        threeRenderer: renderer,
        threeCamera: this.camera,
        sourceLayer: options.layer,
        source: source.canvas,
        dest: dest.canvas,
        size: options.size,
        settings: deepClone(options.filterSettings),
        requestLayerBitmap: options.handleLayerBitmapRequest,
      })
    } finally {
      this.atomicThreeRenderer.release(renderer)
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
      position = { x: 0, y: 0 },
    }: {
      mode: CompositeMode | 'destination-out'
      /** 0 to 100 */
      opacity: number
      position?: { x: number; y: number }
    }
  ) {
    compositeTo.save()

    compositeTo.globalCompositeOperation =
      mode === 'destination-out'
        ? mode
        : layerCompositeModeToCanvasCompositeMode(mode)

    compositeTo.globalAlpha = Math.max(0, Math.min(opacity / 100, 1))
    compositeTo.drawImage(layerImage.canvas, position.x, position.y)

    compositeTo.restore()
  }
}

const layerCompositeModeToCanvasCompositeMode = (mode: CompositeMode) =>
  ((
    {
      normal: 'source-over',
      clipper: 'destination-in',
      multiply: 'multiply',
      overlay: 'overlay',
      screen: 'screen',
    } as { [k in CompositeMode]: GlobalCompositeOperation }
  )[mode])
