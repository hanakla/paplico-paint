import { BrushSetting, LayerTypes } from 'Entity'
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
  protected bufferCanvas: HTMLCanvasElement
  protected strokeCanvas: HTMLCanvasElement
  protected strokeCanvasCtx: CanvasRenderingContext2D
  protected previewCanvas: HTMLCanvasElement
  protected previewCtx: CanvasRenderingContext2D
  protected mitt: Emitter<EngineEvents>

  public readonly previews: Map<string, string> = new Map()

  protected document: Document | null = null
  protected _currentBrush: IBrush = new Brush()
  protected currentInk: IInk = new RandomInk()
  protected _activeLayer: LayerTypes | null = null
  protected _brushSetting: BrushSetting = {weight: 1, color: {r:0,g:0,b:0}, opacity: 1}
  protected _pencilMode: 'draw' | 'erase' = 'draw'
  protected blushPromise: Promise<void> | null = null

  public on: Emitter<EngineEvents>['on']
  public off: Emitter<EngineEvents>['on']

  constructor({ canvas }: { canvas: HTMLCanvasElement }) {
    this.mitt = mitt()
    this.canvas = canvas
    this.canvasHandler = new CanvasHandler(canvas)

    this.bufferCanvas = document.createElement('canvas')

    this.strokeCanvas = document.createElement('canvas')
    this.strokeCanvasCtx = this.strokeCanvas.getContext('2d')!

    this.previewCanvas = document.createElement('canvas')
    Object.assign(this.previewCanvas, {width: 100, height: 100 })
    this.previewCtx = this.previewCanvas.getContext('2d')!

    this.on = this.mitt.on.bind(this.mitt)
    this.off = this.mitt.off.bind(this.mitt)

    this._currentBrush.initialize()

    // this.canvasHandler.on('tmpStroke', (e) => {
    //   console.log(e)
    // })

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

    console.log('rerernder')

    const images = await Promise.all(
      [...this.document.layers].reverse().map(async layer => {
        if (layer.layerType !== 'raster') return [layer.id, layer, null] as const
        if (!layer.visible) return [layer.id, layer, null] as const
        return [layer.id, layer, await createImageBitmap(new ImageData(layer.bitmap, layer.width, layer.height))] as const
      })
    )

    for(const [id,, image] of images) {
      if (image == null) continue

      this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height)
      this.previewCtx.drawImage(image, 0, 0, this.previewCanvas.width, this.previewCanvas.height)

      // generate thumbnails
      await new Promise<void>(resolve => {
        this.previewCanvas.toBlob((blob) => {
          const oldUrl = this.previews.get(id)
          if (oldUrl) URL.revokeObjectURL(oldUrl)

          this.previews.set(id, URL.createObjectURL(blob))
          resolve()
        }, 'image/png')
      })
    }

    this.canvasHandler.context.clearRect(0, 0, this.document.width, this.document.height)

    for (const [,layer, image] of images) {
      if (image == null) continue
      this.canvasHandler.context.globalCompositeOperation = layer.compositeMode
      this.canvasHandler.context.globalAlpha = Math.max(0, Math.min(layer.opacity / 100, 1))
      this.canvasHandler.context.drawImage(image, 0, 0)
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

    this.bufferCanvas.width = document.width
    this.bufferCanvas.height = document.height

    this.strokeCanvas.width = document.width
    this.strokeCanvas.height = document.height
  }

  public async setBrush(Brush: { new(): IBrush }) {
    this._currentBrush = new Brush()
    this.blushPromise = this._currentBrush.initialize()
    await this.blushPromise
  }

  public get currentBrush() {
    return this._currentBrush
  }

  public get brushSetting() {
    return {...this._brushSetting}
  }

  public set brushSetting(config: BrushSetting) {
    this._brushSetting = {...config}
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
    this._activeLayer = this.document.layers.find((layer) => layer.id === this.document!.activeLayerId) ?? null
    this.mitt.emit('activeLayerChanged')
  }

  private handleCanvasStroke = async (stroke: Stroke) => {
    if (this.document == null) return
    await this.blushPromise

    if (this.activeLayer?.layerType == 'raster') {
      const {activeLayer} = this
      const {width, height} = this.document

      const bufCtx = this.bufferCanvas.getContext('2d')!
      const strokeCtx = this.strokeCanvasCtx

      bufCtx.clearRect(0,0, width, height)
      strokeCtx.clearRect(0,0,width, height)

      this.strokeCanvas.width = this.bufferCanvas.width = this.document.width
      this.strokeCanvas.height = this.bufferCanvas.height = this.document.height
      bufCtx.drawImage(await createImageBitmap(new ImageData(activeLayer.bitmap, activeLayer.width, activeLayer.height)), 0, 0)

      this._currentBrush.render({context: strokeCtx, stroke, ink: this.currentInk, brushSetting: this.brushSetting})
      bufCtx.globalCompositeOperation = this._pencilMode === 'draw' ? 'source-over' : 'destination-out'
      bufCtx.drawImage(this.strokeCanvas, 0, 0)

      activeLayer.bitmap.set(bufCtx.getImageData(0, 0, activeLayer.width, activeLayer.height).data)
      this.rerender()
      this.mitt.emit('rerender')
    } else if (this.activeLayer?.layerType === 'vector') {
    }
  }

  private handleLayerChange = () => {
    this.rerender()
  }
}
