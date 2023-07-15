// import type { Delta } from 'rc'
import { diff, patch, unpatch, Delta } from '@paplico/jsondiffpatch'
// ^-- Do not use star imports or named imports from jsondiffpatch-rc, it will break the build.

import { ICommand } from '../ICommand'
import { RuntimeDocument } from '@/Engine'
import { deepClone } from '@/utils/object'
import { VectorLayer } from '@/Document/LayerEntity'

type Options = { updater: (layer: VectorLayer) => void }

export class VectorUpdateLayer implements ICommand {
  public readonly name = 'VectorUpdateLayer'

  protected layerId: string
  protected options: Options

  protected changesPatch: Delta | null = null

  constructor(targetLayerId: string, options: Options) {
    this.layerId = targetLayerId
    this.options = options
  }

  public async do(document: RuntimeDocument): Promise<void> {
    const layer = document.resolveLayer(this.layerId)
    if (!layer) throw new Error('Layer not found')
    if (layer.source.layerType !== 'vector') return

    const original = deepClone(layer.source)
    const next = deepClone(original)
    this.options.updater(next)

    this.changesPatch = diff(original, next)!
    console.log({ changesPatch: this.changesPatch, original, next })
    patch(layer.source, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async undo(document: RuntimeDocument): Promise<void> {
    const layer = document.resolveLayer(this.layerId)
    if (!layer) throw new Error('Layer not found')
    if (layer.source.layerType !== 'vector') return
    if (!this.changesPatch) return

    unpatch(layer.source, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async redo(document: RuntimeDocument): Promise<void> {
    const layer = document.resolveLayer(this.layerId)
    if (!layer) throw new Error('Layer not found')
    if (layer.source.layerType !== 'vector') return
    if (!this.changesPatch) return

    patch(layer.source, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  get effectedLayers() {
    return [this.layerId]
  }
}
