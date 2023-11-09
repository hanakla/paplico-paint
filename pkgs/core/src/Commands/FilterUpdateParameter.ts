import { Delta, diff, unpatch } from '@/utils/jsondiff'

import { ICommand } from '../Engine/History/ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@/utils/object'
import {
  PPLCOptionInvariantViolationError,
  PPLCTargetEntityNotFoundError,
} from '@/Errors'

export class FilterUpdateParameter implements ICommand {
  public readonly name = 'FilterUpdateParameter'

  protected layerUid: string
  protected filterUid: string
  protected changedParam: Record<string, any>
  protected changesPatch: Delta | null = null

  constructor(
    layerUid: string,
    appearanceUid: string,
    changedParam: Record<string, any>,
  ) {
    this.layerUid = layerUid
    this.filterUid = appearanceUid
    this.changedParam = changedParam
  }

  public async do(document: DocumentContext): Promise<void> {
    const visu = document.resolveVisuByUid(this.layerUid)
    if (!visu) throw new PPLCTargetEntityNotFoundError('Layer not found')

    const filter = visu.filters.find((f) => f.uid === this.filterUid)
    if (!filter) throw new PPLCTargetEntityNotFoundError('Filter not found')
    if (filter.kind !== 'postprocess') {
      throw new PPLCOptionInvariantViolationError(
        'FilterUpdateParameter: Filter is not postprocess',
      )
    }

    const prev = deepClone(filter.processor.settings)
    const next = deepClone(this.changedParam)

    this.changesPatch = diff(prev, next)!
    Object.assign(filter.processor.settings, next)
  }

  public async undo(document: DocumentContext): Promise<void> {
    if (!this.changesPatch) return

    const visu = document.resolveVisuByUid(this.layerUid)
    if (!visu) throw new PPLCTargetEntityNotFoundError('Layer not found')

    const filter = visu.filters.find((f) => f.uid === this.filterUid)
    if (!filter) throw new PPLCTargetEntityNotFoundError('Filter not found')
    if (filter.kind !== 'postprocess') {
      throw new PPLCOptionInvariantViolationError(
        'FilterUpdateParameter: Filter is not postprocess',
      )
    }

    unpatch(filter.processor.settings, this.changesPatch)
    document.invalidateLayerBitmapCache(this.layerUid)
  }

  public async redo(document: DocumentContext): Promise<void> {
    return this.do(document)
  }

  get effectedVisuUids() {
    return [this.layerUid]
  }
}
