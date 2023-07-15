import { PaplicoDocument, getLayerNodeAt } from '@/Document'
import { ICommand } from '../ICommand'
import { RuntimeDocument } from '@/Engine'

type Options = { updater: (bitmap: Uint8ClampedArray) => void }

export class RasterUpdateBitmap implements ICommand {
  public readonly name = 'RasterUpdateBitmap'

  protected layerId: string
  protected options: Options

  protected previous: Uint8Array | null = null
  protected updated: Uint8Array | null = null

  constructor(targetLayerId: string, options: Options) {
    this.layerId = targetLayerId
    this.options = options
  }

  public async do(document: RuntimeDocument): Promise<void> {
    const layer = document.resolveLayer(this.layerId)
    if (!layer) throw new Error('Layer not found')
    if (layer.source.layerType !== 'raster') return

    this.previous = new Uint8Array(layer.source.bitmap)
    this.options.updater(layer.source.bitmap)
    this.updated = new Uint8Array(layer.source.bitmap)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async undo(document: RuntimeDocument): Promise<void> {
    const layer = document.resolveLayer(this.layerId)
    if (!layer) throw new Error('Layer not found')
    if (layer.source.layerType !== 'raster') return
    if (!this.previous) return

    layer.source.bitmap.set(this.previous)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async redo(document: RuntimeDocument): Promise<void> {
    const layer = document.resolveLayer(this.layerId)
    if (!layer) throw new Error('Layer not found')
    if (layer.source.layerType !== 'raster') return
    if (!this.updated) return

    layer.source.bitmap.set(this.updated)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  get effectedLayers() {
    return [this.layerId]
  }
}
