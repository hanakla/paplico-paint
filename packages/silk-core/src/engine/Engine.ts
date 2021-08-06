import { BrushSetting, LayerTypes } from '../Entity'
import { Document } from '../Entity/Document'
import { Brush } from '../Brushes/Brush'
import { CanvasHandler } from './CanvasHandler'
import mitt, { Emitter } from 'mitt'
import { RandomInk } from './Inks/RandomInk'
import { IInk } from './Inks/IInk'
import { ExampleBrush } from '../Brushes/ExampleBrush'
import { IBrush } from './IBrush'
import { Stroke } from './Stroke'

type EngineEvents = {
  rerender: void
  activeLayerChanged: void
}

export class SilkEngine {
  protected canvas: HTMLCanvasElement
  protected canvasHandler: CanvasHandler
  protected bufferCtx: CanvasRenderingContext2D
  protected strokeCanvas: HTMLCanvasElement
  protected strokeCanvasCtx: CanvasRenderingContext2D
  protected strokingPreviewCtx: CanvasRenderingContext2D
  protected previewCanvas: HTMLCanvasElement
  protected previewCtx: CanvasRenderingContext2D
  protected mitt: Emitter<EngineEvents>

  public readonly previews: Map<string, string> = new Map()

  protected document: Document | null = null
  protected _currentBrush: IBrush = new Brush()
  protected currentInk: IInk = new RandomInk()
  protected _activeLayer: LayerTypes | null = null
  protected _brushSetting: BrushSetting = {
    weight: 1,
    color: { r: 0, g: 0, b: 0 },
    opacity: 1,
  }
  protected _pencilMode: 'draw' | 'erase' = 'draw'
  protected blushPromise: Promise<void> | null = null
  protected lastRenderedAt: WeakMap<LayerTypes, number> = new WeakMap()

  public on: Emitter<EngineEvents>['on']
  public off: Emitter<EngineEvents>['on']

  constructor({ canvas }: { canvas: HTMLCanvasElement }) {
    this.mitt = mitt()
    this.canvas = canvas
    this.canvasHandler = new CanvasHandler(canvas)

    this.bufferCtx = document.createElement('canvas').getContext('2d')!

    this.strokeCanvas = document.createElement('canvas')
    this.strokeCanvasCtx = this.strokeCanvas.getContext('2d')!
    this.strokingPreviewCtx = document
      .createElement('canvas')!
      .getContext('2d')!

    document.body.appendChild(this.strokingPreviewCtx.canvas)

    this.previewCanvas = document.createElement('canvas')
    Object.assign(this.previewCanvas, { width: 100, height: 100 })
    this.previewCtx = this.previewCanvas.getContext('2d')!

    this.on = this.mitt.on.bind(this.mitt)
    this.off = this.mitt.off.bind(this.mitt)

    this._currentBrush.initialize()

    this.canvasHandler.on('tmpStroke', this.handleTemporayStroke)
    this.canvasHandler.on('stroke', this.handleCanvasStroke)

    // declare const a: SVGPathElement
    // a.getPointAtLength
  }

  public set pencilMode(mode: 'draw' | 'erase') {
    this._pencilMode = mode
  }

  public get pencilMode() {
    return this._pencilMode
  }

  public async rerender() {
    if (!this.document) return

    const images = await Promise.all(
      [...this.document.layers].reverse().map(async (layer) => {
        if (layer.layerType !== 'raster')
          return [layer.id, layer, null] as const

        if (!layer.visible) return [layer.id, layer, null] as const
        if (this.canvasHandler.stroking && layer.id === this._activeLayer?.id)
          return [layer.id, layer, null] as const

        return [
          layer.id,
          layer,
          await createImageBitmap(
            new ImageData(layer.bitmap, layer.width, layer.height)
          ),
        ] as const
      })
    )

    // generete preview thumbnails
    for (const [id, , image] of images) {
      if (image == null) continue

      this.previewCtx.clearRect(
        0,
        0,
        this.previewCanvas.width,
        this.previewCanvas.height
      )
      this.previewCtx.drawImage(
        image,
        0,
        0,
        this.previewCanvas.width,
        this.previewCanvas.height
      )

      // generate thumbnails
      await new Promise<void>((resolve) => {
        this.previewCanvas.toBlob((blob) => {
          const oldUrl = this.previews.get(id)
          if (oldUrl) URL.revokeObjectURL(oldUrl)

          this.previews.set(id, URL.createObjectURL(blob))
          resolve()
        }, 'image/png')
      })
    }

    this.canvasHandler.context.clearRect(
      0,
      0,
      this.document.width,
      this.document.height
    )

    for (const [, layer, image] of images) {
      this.canvasHandler.context.globalCompositeOperation = layer.compositeMode
      this.canvasHandler.context.globalAlpha = Math.max(
        0,
        Math.min(layer.opacity / 100, 1)
      )

      if (image != null) {
        this.canvasHandler.context.drawImage(image, 0, 0)
      } else {
        if (this.canvasHandler.stroking && layer.id === this._activeLayer?.id) {
          this.canvasHandler.context.drawImage(
            this.strokingPreviewCtx.canvas,
            0,
            0
          )
        }
      }
    }

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

    this.canvas.width = document.width
    this.canvas.height = document.height

    Object.assign(this.bufferCtx.canvas, {
      width: document.width,
      height: document.height,
    })

    this.strokeCanvas.width = document.width
    this.strokeCanvas.height = document.height
  }

  public async setBrush(Brush: { new (): IBrush }) {
    this._currentBrush = new Brush()
    this.blushPromise = this._currentBrush.initialize()
    await this.blushPromise
  }

  public get currentBrush() {
    return this._currentBrush
  }

  public get brushSetting() {
    return { ...this._brushSetting }
  }

  public set brushSetting(config: BrushSetting) {
    this._brushSetting = { ...config }
  }

  public get canvasScale() {
    return this.canvasHandler.scale
  }

  public set canvasScale(scale: number) {
    this.canvasHandler.scale = scale
  }

  public setActiveLayer(id: string) {
    if (!this.document) return

    this.document.activeLayerId = id
    this._activeLayer =
      this.document.layers.find(
        (layer) => layer.id === this.document!.activeLayerId
      ) ?? null
    this.mitt.emit('activeLayerChanged')
  }

  private handleTemporayStroke = async (stroke: Stroke) => {
    if (this.document == null) return

    if (this.activeLayer?.layerType === 'raster') {
      const { activeLayer, strokingPreviewCtx, strokeCanvasCtx } = this
      const { width, height } = this.document

      strokingPreviewCtx.clearRect(0, 0, width, height)
      strokeCanvasCtx.clearRect(0, 0, width, height)

      strokingPreviewCtx.canvas.width = strokeCanvasCtx.canvas.width = width
      strokingPreviewCtx.canvas.height = strokeCanvasCtx.canvas.height = height

      strokeCanvasCtx.save()
      this._currentBrush.render({
        context: strokeCanvasCtx,
        stroke,
        ink: this.currentInk,
        brushSetting: this.brushSetting,
      })
      strokeCanvasCtx.restore()

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
    await this.blushPromise

    if (this.activeLayer?.layerType == 'raster') {
      const { activeLayer, strokeCanvasCtx, bufferCtx } = this
      const { width, height } = this.document

      bufferCtx.clearRect(0, 0, width, height)
      strokeCanvasCtx.clearRect(0, 0, width, height)

      this.strokeCanvas.width = this.bufferCtx.canvas.width =
        this.document.width
      this.strokeCanvas.height = this.bufferCtx.canvas.height =
        this.document.height

      strokeCanvasCtx.save()
      this._currentBrush.render({
        context: strokeCanvasCtx,
        stroke,
        ink: this.currentInk,
        brushSetting: this.brushSetting,
      })
      strokeCanvasCtx.restore()

      bufferCtx.drawImage(await activeLayer.imageBitmap, 0, 0)
      bufferCtx.globalCompositeOperation =
        this._pencilMode === 'draw' ? 'source-over' : 'destination-out'
      bufferCtx.drawImage(this.strokeCanvas, 0, 0)

      await activeLayer.updateBitmap((bitmap) => {
        bitmap.set(
          bufferCtx.getImageData(0, 0, activeLayer.width, activeLayer.height)
            .data
        )
      })

      this.rerender()
    } else if (this.activeLayer?.layerType === 'vector') {
    }
  }

  private handleLayerChange = () => {
    this.rerender()
  }
}
