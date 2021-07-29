import { BrushSetting, Layer, VectorLayer } from 'Entity'
import { Document } from '../Entity/Document'
import { Brush } from './Brush'
import { CanvasHandler } from './CanvasHandler'
import mitt, { Emitter } from 'mitt'
import { RandomInk } from './Inks/RandomInk'
import { IInk } from './Inks/IInk'

export class SilkEngine {
  protected canvas: HTMLCanvasElement
  protected canvasHandler: CanvasHandler
  protected bufferCanvas: HTMLCanvasElement
  protected previewCanvas: HTMLCanvasElement
  protected previewCtx: CanvasRenderingContext2D
  protected mitt: Emitter<any>

  public readonly previews: Map<string, string> = new Map()

  protected document: Document
  protected currentBrush: Brush = new Brush()
  protected currentInk: IInk = new RandomInk()
  protected _activeLayer: Layer | VectorLayer | null = null
  protected _brushSetting: BrushSetting = {weight: 1, color: {r:0,g:0,b:0,a:0}}

  public on: Emitter<any>['on']
  public off: Emitter<any>['on']

  constructor({ canvas }: { canvas: HTMLCanvasElement }) {
    this.mitt = mitt()
    this.canvas = canvas
    this.canvasHandler = new CanvasHandler(canvas)

    this.bufferCanvas = document.createElement('canvas')
    this.previewCanvas = document.createElement('canvas')
    this.previewCanvas.width = 100
    this.previewCanvas.height = 100
    this.previewCtx = this.previewCanvas.getContext('2d')

    this.on = this.mitt.on.bind(this.mitt)
    this.off = this.mitt.off.bind(this.mitt)

    // this.canvasHandler.on('tmpStroke', (e) => {
    //   console.log(e)
    // })

    this.canvasHandler.on('stroke', async (stroke) => {
      if (this.activeLayer?.layerType != 'raster') return

      const bufCtx = this.bufferCanvas.getContext('2d')
      this.bufferCanvas.width = this.document.width
      this.bufferCanvas.height = this.document.height
      bufCtx.drawImage(await createImageBitmap(new ImageData(this.activeLayer.bitmap, this.document.width, this.document.height)), 0, 0)

      this.currentBrush.render({context: bufCtx, stroke, ink: this.currentInk, brushSetting: this.brushSetting})
      this.activeLayer.bitmap.set(bufCtx.getImageData(0, 0, this.document.width, this.document.height).data)
      this.rerender()
      this.mitt.emit('rerender')
    })

    // declare const a: SVGPathElement
    // a.getPointAtLength
  }

  public async rerender() {
    if (!this.document) return

    this.canvasHandler.context.clearRect(0, 0, this.document.width, this.document.height)

    const images = await Promise.all(
      this.document.layers.map(async layer => {
        if (layer.layerType !== 'raster') return [layer.id, null] as const
        if (!layer.visible) return [layer.id, null] as const
        return [layer.id, await createImageBitmap(new ImageData(layer.bitmap, this.document.width, this.document.height))] as const
      })
    )

    for(const [id, image] of images.reverse()) {
      if (image == null) continue

      this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height)
      this.previewCtx.drawImage(image, 0, 0, this.previewCanvas.width, this.previewCanvas.height)

      await new Promise<void>(resolve => {
        this.previewCanvas.toBlob((blob) => {
          const oldUrl = this.previews.get(id)
          if (oldUrl) URL.revokeObjectURL(oldUrl)

          this.previews.set(id, URL.createObjectURL(blob))
          resolve()
        }, 'image/png')
      })

      this.canvasHandler.context.drawImage(image, 0, 0)
    }
  }

  public get activeLayer() {
    return this._activeLayer
  }

  public get currentDocument() {
    return this.document
  }

  public async setDocument(document: Document) {
    this.document = document

    this.canvas.width = document.width
    this.canvas.height = document.height

    this.bufferCanvas.width = document.width
    this.bufferCanvas.height = document.height
  }

  public setBrush(brush: Brush) {
    this.currentBrush = brush
  }

  public get brushSetting() {
    return {...this._brushSetting}
  }

  public set brushSetting(config: BrushSetting) {
    this._brushSetting = {...config}
  }

  public setActiveLayer(id: string) {
    this.document.activeLayerId = id
    this._activeLayer = this.document.layers.find((layer) => layer.id === this.document.activeLayerId)
  }
}
