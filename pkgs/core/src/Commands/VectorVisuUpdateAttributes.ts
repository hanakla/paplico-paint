import { typedArraySafeDiff, patch, unpatch, Delta } from '@/utils/jsondiff'

import { ICommand } from '../Engine/History/ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone, omit } from '@paplico/shared-lib'
import { VisuElement } from '@/Document'
import { PPLCCommandExecutionError } from '@/Errors'

type Options = {
  updater: (
    layer: Omit<
      VisuElement.VectorObjectElement,
      'type' | 'filters' | 'path'
    > & {
      path: VisuElement.LoosedTypeVectorPath
    },
  ) => void
}

/**
 * Update Vector Visu's attributes.
 *
 * `.type` and `.filters` can not be changed.
 * If you want to change filters, use `VisuManipulateFilters` command instead.
 */
export class VectorVisuUpdateAttributes implements ICommand {
  public readonly name = 'VectorVisuUpdateAttributes'

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
    if (visu.type !== 'vectorObject')
      throw new PPLCCommandExecutionError('Target Visu is not vectorObject')

    const original = visu
    const next = deepClone(original) satisfies VisuElement.VectorObjectElement
    this.options.updater(next as any)

    next.path.points = next.path.points.map(
      (p): VisuElement.VectorPathPoint =>
        // prettier-ignore
        p.isMoveTo ? { isMoveTo: true, x: p.x, y: p.y, }
      : p.isClose ? { isClose: true, }
      : omit(p, ['isClose', 'isMoveTo']),
    )

    this.changesPatch = typedArraySafeDiff(original, next)!

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
