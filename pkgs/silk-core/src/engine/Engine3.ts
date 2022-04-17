import * as THREE from 'three'
import mitt, { Emitter } from 'mitt'
import getBound from 'svg-path-bounds'

import { Brush, ScatterBrush } from '../Brushes'
import { Document, Path, VectorLayer } from '../SilkDOM'
import { deepClone, mergeToNew, setCanvasSize } from '../utils'
import { CurrentBrushSetting as _CurrentBrushSetting } from './CurrentBrushSetting'
import { IRenderStrategy } from './RenderStrategy/IRenderStrategy'
import { ToolRegistry } from './Engine3_ToolRegistry'
import { Stroke } from './Stroke'
import { PlainInk } from '../Inks/PlainInk'
import { WebGLContext } from './WebGLContext'
import { IFilter } from './IFilter'
import { CompositeMode } from '../SilkDOM/IRenderable'
import { FullRender } from './RenderStrategy/FullRender'
import {
  createCanvas,
  createContext2D,
  createWebGLContext,
} from '../Engine3_CanvasFactory'
import { BrushSetting } from '../Value'
import { IBrush } from './IBrush'
import { IInk } from '../Inks/IInk'
import { AtomicResource } from '../AtomicResource'

import { BloomFilter } from '../Filters/Bloom'
import { ChromaticAberrationFilter } from '../Filters/ChromaticAberration'
import { GaussBlurFilter } from '../Filters/GaussBlur'
import { HalftoneFilter } from '../Filters/HalfTone'
import { GlitchJpeg } from '../Filters/GlitchJpeg'

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
      silk.toolRegistry.registerFilter(GlitchJpeg),
      silk.toolRegistry.registerFilter(GaussBlurFilter),
      silk.toolRegistry.registerFilter(ChromaticAberrationFilter),
      silk.toolRegistry.registerFilter(HalftoneFilter),
    ])

    return silk
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

    const buffer = createContext2D()
    this.atomicBufferCtx = new AtomicResource(buffer!)

    this.gl = new WebGLContext()
    this.toolRegistry = new ToolRegistry(this.gl)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      canvas: createCanvas() as HTMLCanvasElement,
    })
    renderer.setClearColor(0xffffff, 0)

    this.atomicThreeRenderer = new AtomicResource(renderer)
    this.atomicPreDestCtx = new AtomicResource(createContext2D())

    this.camera = new THREE.OrthographicCamera(0, 0, 0, 0, 0, 1000)
    // this.scene = new THREE.Scene()

    // document.body.appendChild(renderer.domElement)
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
    const preDestCtx = await this.atomicPreDestCtx.enjure({ owner: this })

    try {
      setCanvasSize(this.canvasCtx.canvas, document.width, document.height)
      setCanvasSize(preDestCtx.canvas, document.width, document.height)

      this.canvasCtx.clearRect(0, 0, document.width, document.height)
      preDestCtx.clearRect(0, 0, document.width, document.height)

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

      await strategy.render(this, document, preDestCtx)
      this.canvasCtx.drawImage(preDestCtx.canvas, 0, 0)

      this.mitt.emit('rerender')
    } finally {
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
      this.atomicThreeRenderer.release(renderer)
      this.atomicRender.release(lock)
    }
  }

  public async renderPath(
    brushSetting: BrushSetting & { specific: Record<string, any> | null },
    ink: IInk,
    path: Path,
    destCtx: CanvasRenderingContext2D
  ) {
    if (path.points.length < 1) return

    const lock = await this.atomicStrokeRender.enjure({ owner: this })
    const brush = this.toolRegistry.getBrushInstance(brushSetting.brushId)

    if (!brush) {
      throw new Error(
        `Failed to render stroke: Brush not found ${brushSetting.brushId}`
      )
    }

    const renderer = await this.atomicThreeRenderer.enjure({ owner: this })

    renderer.setSize(destCtx.canvas.width, destCtx.canvas.height)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()

    this.camera.left = -destCtx.canvas.width / 2.0
    this.camera.right = destCtx.canvas.width / 2.0
    this.camera.top = destCtx.canvas.height / 2.0
    this.camera.bottom = -destCtx.canvas.height / 2.0
    this.camera.updateProjectionMatrix()

    destCtx.save()
    try {
      brush.render({
        brushSetting: brushSetting,
        context: destCtx,
        threeRenderer: renderer,
        threeCamera: this.camera,
        ink: ink,
        path: path,
        destSize: {
          width: destCtx.canvas.width,
          height: destCtx.canvas.height,
        },
      })
    } finally {
      destCtx.restore()

      this.atomicThreeRenderer.release(renderer)
      this.atomicStrokeRender.release(lock)
    }
  }

  public async renderVectorLayer(document: Document, layer: VectorLayer) {
    const { width, height } = document
    const bufferCtx = await this.atomicBufferCtx.enjure({ owner: this })

    try {
      const bitmap = new Uint8ClampedArray(width * height * 4)

      setCanvasSize(bufferCtx.canvas, width, height)
      bufferCtx.clearRect(0, 0, width, height)

      for (const object of layer.objects) {
        bufferCtx.save()
        bufferCtx.globalCompositeOperation = 'source-over'
        bufferCtx.transform(...object.matrix)

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
              const [left, top, right, bottom] = getBound(object.path.svgPath)

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
        }

        if (object.brush) {
          const brush = this.toolRegistry.getBrushInstance(
            object.brush.brushId
          )!

          if (brush == null)
            throw new Error(`Unregistered brush ${object.brush.brushId}`)

          const stroke = Stroke.fromPath(object.path)

          await this.renderPath(
            mergeToNew(object.brush, { specific: {} }),
            new PlainInk(),
            stroke.path,
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

    const renderer = await this.atomicThreeRenderer.enjure({ owner: this })

    renderer.setSize(dest.canvas.width, dest.canvas.height)
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
        source: source.canvas,
        dest: dest.canvas,
        size: options.size,
        settings: deepClone(options.filterSettings),
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
    }: {
      mode: CompositeMode | 'destination-out'
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
