import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, LayerTypes } from '../../DOM'

type Ordering = { delta: number } | { exactly: number }

export class LayerFilterReorder implements ICommand {
  public readonly name = 'LayerFilterReorder'

  private pathToTargetLayer: string[]
  private filterUid: string
  private oldIndex: number | null = null
  private newIndex: Ordering

  constructor({
    pathToTargetLayer,
    filterUid,
    newIndex,
  }: {
    pathToTargetLayer: string[]
    filterUid: string
    newIndex: Ordering
  }) {
    this.pathToTargetLayer = pathToTargetLayer
    this.filterUid = filterUid
    this.newIndex = newIndex
  }

  async do(document: Document) {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      strict: true,
    })

    this.oldIndex = layer.filters.findIndex((f) => f.uid === this.filterUid)
    if (this.oldIndex === -1)
      throw new Error(
        `FilterReorder: specified filter not found ${this.filterUid}`
      )

    layer.update((l: LayerTypes) => {
      const filter = layer.filters[this.oldIndex!]

      const nextIndex =
        'delta' in this.newIndex
          ? this.oldIndex! + this.newIndex.delta
          : this.newIndex.exactly

      l.filters.splice(this.oldIndex!, 1)
      l.filters.splice(nextIndex, 0, filter)
    })
  }

  async undo(document: Document): Promise<void> {
    if (this.oldIndex == null) return

    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      strict: true,
    })

    const currentIndex = layer.filters.findIndex(
      (f) => f.uid === this.filterUid
    )
    if (this.oldIndex === -1)
      throw new Error(
        `FilterReorder: specified filter not found ${this.filterUid}`
      )

    layer.update((l) => {
      const filter = layer.filters[currentIndex]

      const nextIndex =
        'delta' in this.newIndex
          ? this.oldIndex! + -this.newIndex.delta
          : this.oldIndex

      l.filters.splice(currentIndex, 1)
      l.filters.splice(nextIndex!, 0, filter)
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}
