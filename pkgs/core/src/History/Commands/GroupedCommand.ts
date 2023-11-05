import { diff, patch, unpatch, Delta } from 'jsondiffpatch'

import { ICommand } from '../ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@/utils/object'
import { VisuallyElement } from '@/Document/LayerEntity'

type Options = { updater: (layer: VisuallyElement) => void }

export class CommandGroup implements ICommand {
  public readonly name = 'CommandGroup'

  protected freezed: boolean = false
  protected layerId: string
  protected options: Options

  protected changesPatch: Delta | null = null

  constructor(c) {
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

    this.changesPatch = diff(original, next)!
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
