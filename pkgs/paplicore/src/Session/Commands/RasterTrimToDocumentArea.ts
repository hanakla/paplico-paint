import { init, compress, decompress } from '@bokuweb/zstd-wasm'

import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, VectorObject } from '../../DOM'
import { createContext2D } from '../../Engine3_CanvasFactory'
import { setCanvasSize } from '../../utils'

export class RasterTrimToDocumentArea implements ICommand {
  public readonly name = 'RasterTrimToDocumentArea'

  private pathToTargetLayer: string[]
  private previousBBox: {
    x: number
    y: number
    width: number
    height: number
  } | null = null
  private previousImage: Uint8ClampedArray | null = null

  constructor({ pathToTargetLayer }: { pathToTargetLayer: string[] }) {
    this.pathToTargetLayer = pathToTargetLayer
  }

  async do(document: Document) {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'raster',
      strict: true,
    })

    this.previousImage = new Uint8ClampedArray(layer.bitmap.length)
    this.previousImage.set(layer.bitmap) // compress(new Uint8Array(layer.bitmap))
    this.previousBBox = {
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
    }

    const ctx = createContext2D()
    setCanvasSize(ctx.canvas, document)
    ctx.drawImage(await layer.imageBitmap, layer.x, layer.y)

    const nextBitmap = ctx.getImageData(
      0,
      0,
      document.width,
      document.height
    ).data

    layer.updateBitmap((bitmap, l, replaceBitmap) => {
      l.x = 0
      l.y = 0
      replaceBitmap(nextBitmap, {
        width: document.width,
        height: document.height,
      })
    })
  }

  async undo(document: Document): Promise<void> {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'raster',
      strict: true,
    })

    const previous = this.previousImage!
    layer.updateBitmap((bitmap, l, replaceBitmap) => {
      l.x = this.previousBBox!.x
      l.y = this.previousBBox!.y

      replaceBitmap(previous, this.previousBBox!)
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}
