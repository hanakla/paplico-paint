import { init, compress, decompress } from '@bokuweb/zstd-wasm'

import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
import { Document, VectorObject } from '../../SilkDOM'

export class RasterUpdateBitmap implements ICommand {
  public readonly name = 'RasterUpdateBitmap'

  private pathToTargetLayer: string[]
  private updater: (bitmap: Uint8ClampedArray) => void
  private previousImage: Uint8Array | null = null
  private updatedImage: Uint8Array | null = null

  constructor({
    pathToTargetLayer,
    update,
  }: {
    pathToTargetLayer: string[]
    update: (bitmap: Uint8ClampedArray) => void
  }) {
    this.pathToTargetLayer = pathToTargetLayer
    this.updater = update
  }

  async do(document: Document) {
    await init()

    const layer = SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'raster',
      strict: true,
    })

    this.previousImage = new Uint8Array(layer.bitmap.length)
    this.previousImage.set(layer.bitmap) // compress(new Uint8Array(layer.bitmap))
    layer.updateBitmap((bitmap) => this.updater(bitmap))
  }

  async undo(document: Document): Promise<void> {
    await init()

    const layer = SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'raster',
      strict: true,
    })

    // const previous = decompress(this.previousImage!)
    // this.previousImage = null
    // this.updatedImage = compress(new Uint8Array(layer.bitmap))

    const previous = this.previousImage!
    this.previousImage = null
    this.updatedImage = new Uint8Array(layer.bitmap.length)
    this.updatedImage.set(layer.bitmap)

    layer.updateBitmap((l) => l.set(previous))
  }

  async redo(document: Document): Promise<void> {
    await init()

    const layer = SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'raster',
      strict: true,
    })

    const updated = this.updatedImage!
    this.updatedImage = null
    this.previousImage = new Uint8Array(layer.bitmap.length)
    this.previousImage.set(layer.bitmap)

    layer.updateBitmap((l) => l.set(updated))
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}
