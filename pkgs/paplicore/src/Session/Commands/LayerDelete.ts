import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, LayerTypes } from '../../DOM'

export class LayerDelete implements ICommand {
  public readonly name = 'LayerDelete'

  private pathToTargetLayer: string[]

  private pathToParentLayer!: string[]
  private prevIndex!: number
  private layer!: LayerTypes

  constructor({ pathToTargetLayer }: { pathToTargetLayer: string[] }) {
    this.pathToTargetLayer = pathToTargetLayer
  }

  async do(document: Document) {
    const parent = PapDOMDigger.findLayerParent(
      document,
      this.pathToTargetLayer,
      { strict: true }
    )

    this.pathToParentLayer =
      parent instanceof Document
        ? []
        : PapDOMDigger.getPathToLayer(document, parent.uid, {
            strict: true,
          })

    parent.update((l) => {
      const [layerUid] = this.pathToTargetLayer.slice(-1)
      const index = l.layers.findIndex((l) => l.uid === layerUid)
      const [layer] = l.layers.splice(index, 1)

      this.layer = layer
      this.prevIndex = index
    })
  }

  async undo(document: Document): Promise<void> {
    const parent =
      this.pathToParentLayer.length === 0
        ? document
        : PapDOMDigger.findLayer(document, this.pathToParentLayer, {
            kind: 'group',
            strict: true,
          })!

    parent.update((l) => {
      l.layers.splice(this.prevIndex, 0, this.layer)
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}
