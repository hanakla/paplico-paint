import { typedArraySafeDiff, patch, unpatch, Delta } from '@/utils/jsondiff'

import { ICommand } from '../Engine/History/ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@paplico/shared-lib'
import { VisuElement } from '@/Document'

type Options = {
  /**
   * objects can no be modified by this command for performance reason.
   * use `VectorUpdateObject` instead.
   */
  updater: (layer: Omit<VisuElement.VectorObjectElement, 'objects'>) => void
}

/** @deprecated */
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
    const visu = document.resolveVisuByUid(this.layerId)
    if (!visu) throw new Error('Layer not found')
    if (visu.type !== 'vectorObject') return

    const original = deepClone(visu)
    const next = deepClone(original)
    this.options.updater(next)

    this.changesPatch = typedArraySafeDiff(original, next)
    patch(visu, this.changesPatch!)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async undo(document: DocumentContext): Promise<void> {
    const visu = document.resolveVisuByUid(this.layerId)
    if (!visu) throw new Error('Layer not found')
    if (visu.type !== 'vectorObject') return
    if (!this.changesPatch) return

    unpatch(visu, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  public async redo(document: DocumentContext): Promise<void> {
    const layer = document.resolveVisuByUid(this.layerId)
    if (!layer) throw new Error('Layer not found')
    if (layer.type !== 'vectorObject') return
    if (!this.changesPatch) return

    patch(layer, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerId)
  }

  get effectedVisuUids() {
    return [this.layerId]
  }
}
