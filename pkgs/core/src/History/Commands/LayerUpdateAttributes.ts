import { diff, patch, unpatch, Delta } from '@paplico/jsondiffpatch'

import { ICommand } from '../ICommand'
import { RuntimeDocument } from '@/Engine'
import { deepClone } from '@/utils/object'
import { LayerEntity } from '@/Document/LayerEntity'

type Options = { updater: (layer: LayerEntity) => void }

export class LayerUpdateAttributes implements ICommand {
  public readonly name = 'LayerUpdateAttributes'

  protected layerId: string
  protected options: Options

  protected changesPatch: Delta | null = null

  constructor(targetLayerId: string, options: Options) {
    this.layerId = targetLayerId
    this.options = options
  }

  public async do(document: RuntimeDocument): Promise<void> {
    const layer = document.resolveLayer(this.layerId)?.source.deref()
    if (!layer) throw new Error('Layer not found')
    if (layer.layerType !== 'vector') return

    const original = deepClone(layer)
    const next = deepClone(original)
    this.options.updater(next)

    this.changesPatch = diff(original, next)!
    patch(layer, this.changesPatch!)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async undo(document: RuntimeDocument): Promise<void> {
    const layer = document.resolveLayer(this.layerId)?.source.deref()
    if (!layer) throw new Error('Layer not found')
    if (layer.layerType !== 'vector') return
    if (!this.changesPatch) return

    unpatch(layer, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async redo(document: RuntimeDocument): Promise<void> {
    const layer = document.resolveLayer(this.layerId)?.source.deref()
    if (!layer) throw new Error('Layer not found')
    if (layer.layerType !== 'vector') return
    if (!this.changesPatch) return

    patch(layer, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  get effectedLayers() {
    return [this.layerId]
  }
}
