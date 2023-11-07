import { diff, patch, unpatch, Delta } from 'jsondiffpatch'

import { ICommand } from '../Engine/History/ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@/utils/object'
import { VisuElement } from '@/Document/Visually'
import { PPLCCommandExecutionError } from '@/Errors'

type Options = {
  updater: (
    layer: Omit<VisuElement.AnyElement, 'type' | 'path' | 'filters'>,
  ) => void
}

/**
 * Update Visu's attributes.
 * Can only update attributes, Can not changes .type, .path, .filters.
 */
export class VisuUpdateAttributes implements ICommand {
  public readonly name = 'VisuUpdateAttributes'

  protected visuUid: string
  protected options: Options

  protected changesPatch: Delta | null = null

  constructor(targetVisuId: string, options: Options) {
    this.visuUid = targetVisuId
    this.options = options
  }

  public async do(docx: DocumentContext): Promise<void> {
    const visu = docx.document.getVisuByUid(this.visuUid)
    if (!visu) throw new PPLCCommandExecutionError('Target Visu not found')

    const original = visu
    const next = deepClone(original)
    this.options.updater(next)

    this.changesPatch = diff(original, next)!

    console.log('patch', this.changesPatch, {
      visuUid: this.visuUid,
      visu,
      next,
      freeze: Object.isFrozen(visu),
    })
    patch(visu, this.changesPatch!)
    docx.invalidateLayerBitmapCache(this.visuUid)
  }

  public async undo(docx: DocumentContext): Promise<void> {
    const layer = docx.document.getVisuByUid(this.visuUid)
    if (!layer) throw new PPLCCommandExecutionError('Target Visu not found')
    if (!this.changesPatch) return

    unpatch(layer, this.changesPatch)
    docx.invalidateLayerBitmapCache(this.visuUid)
  }

  public async redo(document: DocumentContext): Promise<void> {
    const layer = document.resolveLayer(this.visuUid)?.source.deref()
    if (!layer) throw new PPLCCommandExecutionError('Target Visu not found')
    if (!this.changesPatch) return

    patch(layer, this.changesPatch)
    document.invalidateLayerBitmapCache(this.visuUid)
  }

  get effectedVisuUids() {
    return [this.visuUid]
  }
}
