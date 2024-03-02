import { typedArraySafeDiff, patch, unpatch, Delta } from '@/utils/jsondiff'

import { ICommand } from '../Engine/History/ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@paplico/shared-lib'
import { VisuElement } from '@/Document'
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

    this.changesPatch = typedArraySafeDiff(original, next)!

    if (this.changesPatch) {
      delete (this.changesPatch as any).type
      delete (this.changesPatch as any).path
      delete (this.changesPatch as any).filters
    }

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

  public async redo(docx: DocumentContext): Promise<void> {
    const visu = docx.document.getVisuByUid(this.visuUid)
    if (!visu) throw new PPLCCommandExecutionError('Target Visu not found')
    if (!this.changesPatch) return

    patch(visu, this.changesPatch)
    docx.invalidateLayerBitmapCache(this.visuUid)
  }

  get effectedVisuUids() {
    return [this.visuUid]
  }
}
