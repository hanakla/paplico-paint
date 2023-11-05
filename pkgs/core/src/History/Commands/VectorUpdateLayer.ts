import { diff, patch, unpatch, Delta } from 'jsondiffpatch'
// ^-- Do not use star imports or named imports from jsondiffpatch-rc, it will break the build.

import { ICommand } from '../ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@/utils/object'
import { VectorLayer } from '@/Document/LayerEntity'

type Options = {
  /**
   * objects can no be modified by this command for performance reason.
   * use `VectorUpdateObject` instead.
   */
  updater: (layer: Omit<VectorLayer, 'objects'>) => void
}

export class VectorUpdateLayer implements ICommand {
  public readonly name = 'VectorUpdateLayer'

  protected layerId: string
  protected options: Options

  protected changesPatch: Delta | null = null

  constructor(targetLayerId: string, options: Options) {
    this.layerId = targetLayerId
    this.options = options
  }

  public async do(document: DocumentContext): Promise<void> {
    const layer = document.resolveLayer(this.layerId)?.source.deref()
    if (!layer) throw new Error('Layer not found')
    if (layer.layerType !== 'vector') return

    const original = deepClone(layer)
    const next = deepClone(original)
    this.options.updater(next)

    this.changesPatch = diff(original, next)
    patch(layer, this.changesPatch!)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async undo(document: DocumentContext): Promise<void> {
    const layer = document.resolveLayer(this.layerId)?.source.deref()
    if (!layer) throw new Error('Layer not found')
    if (layer.layerType !== 'vector') return
    if (!this.changesPatch) return

    unpatch(layer, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async redo(document: DocumentContext): Promise<void> {
    const layer = document.resolveLayer(this.layerId)?.source.deref()
    if (!layer) throw new Error('Layer not found')
    if (layer.layerType !== 'vector') return
    if (!this.changesPatch) return

    patch(layer, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  get effectedVisuUids() {
    return [this.layerId]
  }
}
