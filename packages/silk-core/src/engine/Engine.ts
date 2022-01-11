import { LayerTypes, VectorLayer } from '../Entity'
import { Document } from '../Entity/Document'
import { Brush } from '../Brushes/Brush'
import { CanvasHandler } from './CanvasHandler'
import mitt, { Emitter } from 'mitt'
import { RandomInk } from './Inks/RandomInk'
import { IInk } from './Inks/IInk'
import { ExampleBrush } from '../Brushes/ExampleBrush'
import { IBrush, BrushClass } from './IBrush'
import { Stroke } from './Stroke'
import { VectorObject } from '../Entity/VectorObject'
import { assign, AtomicResource, deepClone } from '../utils'
import { CurrentBrushSetting as _CurrentBrushSetting } from './CurrentBrushSetting'
import getBound from 'svg-path-bounds'
import { FilterClass, IFilter } from './IFilter'
import { BloomFilter } from '../Filters/Bloom'
import WebGLContext from './WebGLContext'
import { GaussBlurFilter } from '../Filters/GaussBlur'
import { ChromaticAberrationFilter } from '../Filters/ChromaticAberration'

type EngineEvents = {
  rerender: void
  activeLayerChanged: void
}

type _RenderSetting = {
  disableAllFilters: boolean
  updateThumbnail: boolean
}

export class SilkEngine {
  protected canvas: HTMLCanvasElement
  public readonly canvasHandler: CanvasHandler
  public __dbg_bufferCtx: CanvasRenderingContext2D
  protected strokeCanvasCtx: CanvasRenderingContext2D
  protected strokeCompCtx: CanvasRenderingContext2D
  protected strokingPreviewCtx: CanvasRenderingContext2D
  protected thumbnailCanvas: HTMLCanvasElement
  protected thumbnailCtx: CanvasRenderingContext2D
  protected gl: WebGLContext
  protected atomicBufferCtx: AtomicResource<CanvasRenderingContext2D>
  protected atomicRerender: AtomicResource<any>

  protected mitt: Emitter<EngineEvents>

  public readonly previews: Map<string, string> = new Map()

  protected document: Document | null = null
  protected _currentBrush: IBrush = new Brush()
  protected currentInk: IInk = new RandomInk()
  protected _activeLayer: LayerTypes | null = null
  protected _brushSetting: _CurrentBrushSetting = {
    brushId: Brush.id,
    weight: 1,
    color: { r: 0, g: 0, b: 0 },
    opacity: 1,
  }
  protected _pencilMode: 'none' | 'draw' | 'erase' = 'draw'
  protected blushPromise: Promise<void> | null = null
  protected _renderSetting: _RenderSetting = {
    disableAllFilters: false,
    updateThumbnail: true,
  }

  protected lastRenderedAt: WeakMap<LayerTypes, number> = new WeakMap()

  protected brushRegister = new Map<string, BrushClass>()
  protected brushInstances = new WeakMap<BrushClass, Brush>()

  protected filterRegister = new Map<string, FilterClass>()
  protected filterInstances = new WeakMap<FilterClass, IFilter>()

  protected vectorBitmapCache = new WeakMap<VectorLayer, any>()
  protected vectorLayerLastRenderTimes = new WeakMap<VectorLayer, number>()

  public on: Emitter<EngineEvents>['on']
  public off: Emitter<EngineEvents>['on']

  public static async create({ canvas }: { canvas: HTMLCanvasElement }) {
    const silk = new SilkEngine({ canvas })

    await Promise.all([
      silk.registerBrush(Brush),
      silk.registerFilter(BloomFilter),
      silk.registerFilter(GaussBlurFilter),
      silk.registerFilter(ChromaticAberrationFilter),
    ])

    return silk
  }

  constructor({ canvas }: { canvas: HTMLCanvasElement }) {
    this.mitt = mitt()
    this.canvas = canvas
    this.canvasHandler = new CanvasHandler(canvas)

    const bufferCtx = document.createElement('canvas').getContext('2d')!
    this.__dbg_bufferCtx = bufferCtx
    this.atomicBufferCtx = new AtomicResource(bufferCtx)
    this.atomicRerender = new AtomicResource({})

    this.gl = new WebGLContext(1, 1)

    this.strokeCompCtx = document.createElement('canvas').getContext('2d')!
    this.strokeCanvasCtx = document.createElement('canvas').getContext('2d')!
    this.strokingPreviewCtx = document
      .createElement('canvas')!
      .getContext('2d')!

    document.body.appendChild(this.strokingPreviewCtx.canvas)

    this.thumbnailCanvas = document.createElement('canvas')
    assign(this.thumbnailCanvas, { width: 100, height: 100 })
    this.thumbnailCtx = this.thumbnailCanvas.getContext('2d')!

    this.on = this.mitt.on.bind(this.mitt)
    this.off = this.mitt.off.bind(this.mitt)

    this._currentBrush.initialize()

    this.canvasHandler.on('tmpStroke', this.handleTemporayStroke)
    this.canvasHandler.on('stroke', this.handleCanvasStroke)

    // declare const a: SVGPathElement
    // a.getPointAtLength
  }

  public get renderSetting() {
    return { ...this._renderSetting }
  }

  public set renderSetting(setting: _RenderSetting) {
    this._renderSetting = setting
  }

  public set pencilMode(mode: 'none' | 'draw' | 'erase') {
    this._pencilMode = mode
  }

  public get pencilMode() {
    return this._pencilMode
  }

  public async render({
    disableAllFilters = false,
    updateThumbnail = false,
  }: Partial<_RenderSetting> = {}) {
    if (!this.document) return

    const renderLock = await this.atomicRerender.enjure()
    const { document } = this

    this.gl.setSize(document.width, document.height)

    const images = await Promise.all(
      [...document.layers].map(async (layer) => {
        if (!layer.visible) return [layer.id, layer, null] as const

        switch (layer.layerType) {
          case 'vector': {
            if (
              (this.vectorLayerLastRenderTimes.get(layer) ?? 0) <
              layer.lastUpdatedAt
            ) {
              await this.renderVectorLayer(layer)
            }

            const bitmap = this.vectorBitmapCache.get(layer)

            return [
              layer.id,
              layer,
              await createImageBitmap(
                new ImageData(bitmap, document.width, document.height)
              ),
            ] as const
          }
          case 'raster': {
            if (
              this.canvasHandler.stroking &&
              layer.id === this._activeLayer?.id
            )
              return [layer.id, layer, null] as const

            return [
              layer.id,
              layer,
              await createImageBitmap(
                new ImageData(layer.bitmap, layer.width, layer.height)
              ),
            ] as const
          }
          case 'filter': {
            return [layer.id, layer, null] as const
          }
        }
      })
    )

    // Generate thumbnails
    for (const [id, , image] of images) {
      if (!updateThumbnail) break
      if (image == null) continue

      this.thumbnailCtx.clearRect(
        0,
        0,
        this.thumbnailCanvas.width,
        this.thumbnailCanvas.height
      )
      this.thumbnailCtx.drawImage(
        image,
        0,
        0,
        this.thumbnailCanvas.width,
        this.thumbnailCanvas.height
      )

      // generate thumbnails
      await new Promise<void>((resolve) => {
        this.thumbnailCanvas.toBlob((blob) => {
          if (!blob) return

          const oldUrl = this.previews.get(id)
          if (oldUrl) URL.revokeObjectURL(oldUrl)

          this.previews.set(id, URL.createObjectURL(blob))
          resolve()
        }, 'image/png')
      })
    }

    const bufferCtx = await this.atomicBufferCtx.enjure()
    assign(bufferCtx.canvas, {
      width: document.width,
      height: document.height,
    })

    const destCtx = assign(window.document.createElement('canvas'), {
      width: document.width,
      height: document.height,
    }).getContext('2d')!

    this.canvasHandler.context.save()
    try {
      for (const [, layer, image] of images) {
        bufferCtx.clearRect(0, 0, document.width, document.height)

        if (image == null) {
          if (
            this.canvasHandler.stroking &&
            layer.id === this._activeLayer?.id
          ) {
            this.canvasHandler.context.drawImage(
              this.strokingPreviewCtx.canvas,
              0,
              0
            )

            continue
          } else if (layer.layerType === 'filter') {
            if (!layer.visible) continue
            if (disableAllFilters) continue

            for (const filter of layer.filters) {
              if (!filter.visible) continue

              const FilterClass = this.filterRegister.get(filter.filterId)
              if (!FilterClass)
                throw new Error(`Filter not found (id:${filter.filterId})`)

              const instance = this.filterInstances.get(FilterClass)!

              destCtx.save()
              bufferCtx.save()
              try {
                instance.render({
                  gl: this.gl,
                  source: destCtx.canvas,
                  dest: bufferCtx.canvas,
                  size: { width: document.width, height: document.height },
                  settings: deepClone(filter.settings),
                })
              } catch (e) {
                throw e
              } finally {
                destCtx.restore()
                bufferCtx.restore()
              }

              destCtx.globalCompositeOperation = layer.compositeMode
              destCtx.globalAlpha = Math.max(
                0,
                Math.min(layer.opacity / 100, 1)
              )
              destCtx.drawImage(bufferCtx.canvas, 0, 0)
            }

            continue
          }
        }

        if (image == null) continue

        // TODO: layer.{x,y} 対応
        bufferCtx.drawImage(image, 0, 0)

        for (const filter of layer.filters) {
          if (!filter.visible) continue
          if (disableAllFilters) continue

          const FilterClass = this.filterRegister.get(filter.filterId)
          if (!FilterClass)
            throw new Error(`Filter not found (id:${filter.filterId})`)

          const instance = this.filterInstances.get(FilterClass)!

          bufferCtx.save()
          try {
            instance.render({
              gl: this.gl,
              source: bufferCtx.canvas,
              dest: bufferCtx.canvas,
              size: { width: document.width, height: document.height },
              settings: deepClone(filter.settings),
            })
          } catch (e) {
            throw e
          } finally {
            bufferCtx.restore()
          }
        }

        destCtx.globalCompositeOperation = layer.compositeMode
        destCtx.globalAlpha = Math.max(0, Math.min(layer.opacity / 100, 1))
        destCtx.drawImage(bufferCtx.canvas, 0, 0)
      }

      this.canvasHandler.context.clearRect(
        0,
        0,
        document.width,
        document.height
      )
      this.canvasHandler.context.drawImage(destCtx.canvas, 0, 0)
    } catch (e) {
      throw e
    } finally {
      this.atomicBufferCtx.release(bufferCtx)
      this.canvasHandler.context.restore()
      this.atomicRerender.release(renderLock)
    }

    return {
      export: (mimeType: string, quality?: number) => {
        return new Promise<Blob>((resolve, rejecct) => {
          destCtx.canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob)
              else rejecct(new Error('Failed to export canvas'))
            },
            mimeType,
            quality
          )
        })
      },
    }
  }

  public async rerender() {
    this.render({ ...this.renderSetting, updateThumbnail: true })
    this.mitt.emit('rerender')
  }

  public get activeLayer(): LayerTypes | null {
    return this._activeLayer
  }

  public get currentDocument() {
    return this.document
  }

  public get currentLayerBBox() {
    if (!this._activeLayer) return null

    return {
      x: this._activeLayer.x,
      y: this._activeLayer.y,
      width: this._activeLayer.width,
      height: this._activeLayer.height,
    }
  }

  public async setDocument(document: Document) {
    if (this.document) {
      this.document.off('layersChanged', this.handleLayerChange)
    }

    this.document = document
    this.document.on('layersChanged', this.handleLayerChange)
    this.setActiveLayer(document.activeLayerId)

    this.canvas.width = document.width
    this.canvas.height = document.height

    const bufferCtx = await this.atomicBufferCtx.enjure()

    assign(bufferCtx.canvas, {
      width: document.width,
      height: document.height,
    })

    assign(this.strokeCanvasCtx.canvas, {
      width: document.width,
      height: document.height,
    })

    this.vectorBitmapCache = new WeakMap()
    this.atomicBufferCtx.release(bufferCtx)
  }

  public async registerBrush(Brush: BrushClass) {
    this.brushRegister.set(Brush.id, Brush)

    const brush = new Brush()
    await brush.initialize()
    this.brushInstances.set(Brush, brush)
  }

  public getBrushes() {
    return [...this.brushRegister.values()]
  }

  public async setBrush(Brush: BrushClass) {
    this._currentBrush = new Brush()
    this.blushPromise = this._currentBrush.initialize()
    await this.blushPromise
  }

  public async registerFilter(Filter: FilterClass) {
    this.filterRegister.set(Filter.id, Filter)

    const filter = new Filter()
    await filter.initialize()
    this.filterInstances.set(Filter, filter)
  }

  public getFilters() {
    return [...this.filterRegister.values()]
  }

  public getFilterInstance(id: string) {
    const Class = this.filterRegister.get(id)
    if (!Class) return null

    return this.filterInstances.get(Class)
  }

  public get currentBrush() {
    return this._currentBrush
  }

  public get brushSetting(): SilkEngine.CurrentBrushSetting {
    return { ...this._brushSetting }
  }

  public set brushSetting(config: SilkEngine.CurrentBrushSetting) {
    this._brushSetting = { ...config }
  }

  public get canvasScale() {
    return this.canvasHandler.scale
  }

  public set canvasScale(scale: number) {
    this.canvasHandler.scale = scale
  }

  public setActiveLayer(id: string | null) {
    if (!this.document) return

    this.document.activeLayerId = id
    this._activeLayer =
      this.document.layers.find((layer) => layer.id === id) ?? null

    this.mitt.emit('activeLayerChanged')
  }

  private async renderVectorLayer(layer: VectorLayer) {
    if (!this.document) return

    const { document } = this
    const { width, height } = document
    const bufferCtx = await this.atomicBufferCtx.enjure()

    const bitmap =
      this.vectorBitmapCache.get(layer) ??
      new Uint8ClampedArray(width * height * 4)

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
        // for (const point of object.path.points) {

        // }

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
        const brushClass = this.brushRegister.get(object.brush.brushId)!
        const brush = this.brushInstances.get(brushClass)

        if (brushClass == null || brush == null)
          throw new Error(`Unregistered brush ${object.brush.brushId}`)

        const stroke = Stroke.fromPath(object.path)

        brush.render({
          context: bufferCtx,
          stroke,
          ink: this.currentInk,
          brushSetting: object.brush,
        })
      }

      bufferCtx.restore()
    }

    const data = bufferCtx.getImageData(0, 0, width, height).data
    bitmap.set(data)
    this.vectorBitmapCache.set(layer, bitmap)

    this.atomicBufferCtx.release(bufferCtx)
    return bitmap
  }

  private handleTemporayStroke = async (stroke: Stroke) => {
    if (this.document == null) return
    if (this.pencilMode === 'none') return
    if (!this.activeLayer) return
    if (this.activeLayer.visible === false || this.activeLayer.lock) return

    if (this.activeLayer?.layerType === 'raster') {
      const { activeLayer, strokingPreviewCtx, strokeCanvasCtx } = this
      const { width, height } = this.document

      strokingPreviewCtx.clearRect(0, 0, width, height)
      strokeCanvasCtx.clearRect(0, 0, width, height)

      strokingPreviewCtx.canvas.width = strokeCanvasCtx.canvas.width = width
      strokingPreviewCtx.canvas.height = strokeCanvasCtx.canvas.height = height

      strokeCanvasCtx.save()
      try {
        this._currentBrush.render({
          context: strokeCanvasCtx,
          stroke,
          ink: this.currentInk,
          brushSetting: this.brushSetting,
        })
      } finally {
        strokeCanvasCtx.restore()
      }

      strokingPreviewCtx.drawImage(await activeLayer.imageBitmap, 0, 0)
      strokingPreviewCtx.globalCompositeOperation =
        this._pencilMode === 'draw' ? 'source-over' : 'destination-out'
      strokingPreviewCtx.drawImage(strokeCanvasCtx.canvas, 0, 0)

      this.rerender()
    } else if (this.activeLayer?.layerType === 'vector') {
    }
  }

  private handleCanvasStroke = async (stroke: Stroke) => {
    if (this.document == null) return
    if (this.pencilMode === 'none') return
    if (!this.activeLayer) return
    if (this.activeLayer.visible === false || this.activeLayer.lock) return

    const { document, activeLayer } = this

    await this.blushPromise
    if (activeLayer?.visible === false) return

    if (activeLayer?.layerType === 'raster') {
      const { width, height } = document
      const { strokeCompCtx, strokeCanvasCtx } = this

      assign(strokeCanvasCtx.canvas, {
        width: document.width,
        height: document.height,
      })

      assign(strokeCompCtx.canvas, {
        width: document.width,
        height: document.height,
      })

      strokeCompCtx.clearRect(0, 0, width, height)
      strokeCanvasCtx.clearRect(0, 0, width, height)

      strokeCompCtx.drawImage(await activeLayer.imageBitmap, 0, 0)

      strokeCanvasCtx.save()
      try {
        this._currentBrush.render({
          context: strokeCanvasCtx,
          stroke,
          ink: this.currentInk,
          brushSetting: this.brushSetting,
        })
      } finally {
        strokeCanvasCtx.restore()
      }

      strokeCompCtx.globalCompositeOperation =
        this._pencilMode === 'draw' ? 'source-over' : 'destination-out'
      strokeCompCtx.drawImage(strokeCanvasCtx.canvas, 0, 0)

      await activeLayer.updateBitmap((bitmap) => {
        bitmap.set(
          strokeCompCtx.getImageData(
            0,
            0,
            activeLayer.width,
            activeLayer.height
          ).data
        )
      })

      const rerenderToken = await this.atomicRerender.enjure()
      this.atomicRerender.release(rerenderToken)
      this.rerender()
    } else if (activeLayer?.layerType === 'vector') {
      activeLayer.objects.unshift(
        VectorObject.create({
          x: 0,
          y: 0,
          path: stroke.splinedPath,
          brush: { ...this._brushSetting },
        })
      )

      this.renderVectorLayer(activeLayer)
      this.rerender()
    }
  }

  private handleLayerChange = () => {
    this.rerender()
  }
}

export namespace SilkEngine {
  export type RenderSetting = _RenderSetting
  export type CurrentBrushSetting = _CurrentBrushSetting
}
