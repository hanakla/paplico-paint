import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
import { Document, Filter, LayerTypes } from '../../SilkDOM'

export class LayerRemoveFilter implements ICommand {
  public readonly name = 'LayerRemoveFilter'

  private pathToTargetLayer: string[]
  private filterUid: string
  private oldIndex: number
  private filter: Filter

  constructor({
    pathToTargetLayer,
    filterUid,
  }: {
    pathToTargetLayer: string[]
    filterUid: string
  }) {
    this.pathToTargetLayer = pathToTargetLayer
    this.filterUid = filterUid
  }

  async do(document: Document) {
    const layer = SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      strict: true,
    })

    const index = layer.filters.findIndex((f) => f.uid === this.filterUid)
    if (index === -1)
      throw new Error(`Specified filter not found ${this.filterUid}`)

    this.oldIndex = index
    layer.update((l: LayerTypes) => {
      this.filter = l.filters.splice(index, 1)[0]
    })
  }

  async undo(document: Document): Promise<void> {
    const layer = SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      strict: true,
    })

    layer.update((l: LayerTypes) => {
      l.filters.splice(this.oldIndex, 0, this.filter)
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}
