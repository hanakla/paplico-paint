import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, Filter, LayerTypes } from '../../DOM'

export class LayerTruncateFilters implements ICommand {
  public readonly name = 'LayerTruncateFilters'

  private pathToTargetLayer: string[]
  private prevFilters!: Filter[] = []

  constructor({ pathToTargetLayer }: { pathToTargetLayer: string[] }) {
    this.pathToTargetLayer = pathToTargetLayer
  }

  async do(document: Document) {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      strict: true,
    })

    this.prevFilters = [...layer.filters]

    layer.update((l) => {
      l.filters.splice(0)
    })
  }

  async undo(document: Document): Promise<void> {
    const layer = PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      strict: true,
    })

    layer.update((l: LayerTypes) => {
      l.filters.splice(0, 0, ...this.prevFilters)
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}
