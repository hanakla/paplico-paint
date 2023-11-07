import { diff, patch, unpatch, Delta } from 'jsondiffpatch'
// ^-- Do not use star imports or named imports from jsondiffpatch-rc, it will break the build.

import { ICommand } from '../Engine/History/ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@/utils/object'
import { VectorLayer } from '@/Document/LayerEntity'

type Options = {
  /**
   * objects can no be modified by this command for performance reason.
   * use `VectorUpdateObject` instead.
   */
  updater: (objects: VectorLayer['objects']) => void
}

/** @deprecated */
export class VectorUpdateObjects implements ICommand {
  public readonly name = 'VectorUpdateObjects'

  protected layerId: string
  protected options: Options

  protected changesPatch: Delta | undefined = undefined

  constructor(targetLayerId: string, options: Options) {
    this.layerId = targetLayerId
    this.options = options
  }

  public async do(document: DocumentContext): Promise<void> {
    const layer = document.resolveLayer(this.layerId)?.source.deref()
    if (!layer) throw new Error('Layer not found')
    if (layer.layerType !== 'vector') return

    const original = layer.objects
    const next = deepClone(original)
    this.options.updater(next)

    this.changesPatch = diff(original, next)
    patch(layer.objects, this.changesPatch!)

    document.invalidateLayerBitmapCache(this.layerId)
    // document.invalidateVectorObjectCache()
  }

  public async undo(document: DocumentContext): Promise<void> {
    const layer = document.resolveLayer(this.layerId)?.source.deref()
    if (!layer) throw new Error('Layer not found')
    if (layer.layerType !== 'vector') return
    if (!this.changesPatch) return

    unpatch(layer.objects, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async redo(document: DocumentContext): Promise<void> {
    const layer = document.resolveLayer(this.layerId)?.source.deref()
    if (!layer) throw new Error('Layer not found')
    if (layer.layerType !== 'vector') return
    if (!this.changesPatch) return

    patch(layer.objects, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  get effectedVisuUids() {
    return [this.layerId]
  }
}
