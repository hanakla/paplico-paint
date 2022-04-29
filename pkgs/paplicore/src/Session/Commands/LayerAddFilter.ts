import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, Filter, LayerTypes } from '../../DOM'

export class LayerAddFilter implements ICommand {
  public readonly name = 'LayerAddFilter'

  private filter: Filter
  private pathToTargetLayer: string[]

  constructor({
    pathToTargetLayer,
    filter,
  }: {
    pathToTargetLayer: string[]
    filter: Filter
  }) {
    this.pathToTargetLayer = pathToTargetLayer
    this.filter = filter
  }

  async do(document: Document) {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      strict: true,
    })

    layer.update((l: LayerTypes) => l.filters.unshift(this.filter))
  }

  async undo(document: Document): Promise<void> {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      strict: true,
    })

    const idx = layer.filters.findIndex((o) => o.uid === this.filter.uid)
    if (idx === -1) return
    layer.update((l: LayerTypes) => l.filters.splice(idx, 1))
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}
