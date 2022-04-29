import * as jsondiff from 'jsondiffpatch'

import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Filter } from '../../DOM/Filter'
import { Document } from '../../DOM'
import { deepClone, pick } from '../../utils'

export class FilterPatchAttr implements ICommand {
  public readonly name = 'FilterPatchAttr'

  private pathToTargetLayer: string[]
  private targetFilterUid: string

  private patcher: (filter: Filter.Attributes) => void
  private jsonDelta!: jsondiff.Delta

  constructor({
    pathToTargetLayer,
    filterUid,
    patcher,
  }: {
    pathToTargetLayer: string[]
    filterUid: string
    patcher: (filter: Filter.Attributes) => void
  }) {
    this.pathToTargetLayer = pathToTargetLayer
    this.targetFilterUid = filterUid
    this.patcher = patcher
  }

  async do(document: Document) {
    const filter = PapDOMDigger.findFilter(
      document,
      this.pathToTargetLayer,
      this.targetFilterUid,
      {
        strict: true,
      }
    )

    const original = deepClone(
      pick(filter, ['filterId', 'visible', 'settings'])
    )
    const next = deepClone(original)
    this.patcher(next)

    this.jsonDelta = jsondiff.diff(original, next)!
    filter.update((f) => jsondiff.patch(f, this.jsonDelta))
  }

  async undo(document: Document): Promise<void> {
    const filter = PapDOMDigger.findFilter(
      document,
      this.pathToTargetLayer,
      this.targetFilterUid,
      { strict: true }
    )
    filter.update((f) => jsondiff.unpatch(f, this.jsonDelta))
  }

  async redo(document: Document): Promise<void> {
    const filter = PapDOMDigger.findFilter(
      document,
      this.pathToTargetLayer,
      this.targetFilterUid,
      { strict: true }
    )
    filter.update((f) => jsondiff.patch(f, this.jsonDelta))
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}
