import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, LayerTypes, ReferenceLayer, VectorObject } from '../../DOM'

export class ReferenceConvertToSubstance implements ICommand {
  public readonly name = 'ReferenceConvertToSubstance'

  private referenceLayer: ReferenceLayer
  private sourceLayer!: LayerTypes
  private clonedLayer!: LayerTypes

  constructor({ referenceLayer }: { referenceLayer: ReferenceLayer }) {
    this.referenceLayer = referenceLayer
  }

  async do(document: Document) {
    const layer = PapDOMDigger.findLayerRecursive(
      document,
      this.referenceLayer.uid,
      { strict: true }
    )

    this.clonedLayer = layer.clone()
  }

  async undo(document: Document): Promise<void> {
    document.update((d) => {
      let path = PapDOMDigger.getPathToLayer(document, this.clonedLayer.uid, {
        strict: true,
      })!.slice(0, -1)

      const parent = PapDOMDigger.findLayerParent(d, path)
      const index = parent.layers.findIndex(
        (l) => l.uid === this.clonedLayer.uid
      )
      if (index === -1) return

      parent.layers.splice(1, index)
    })
  }

  async redo(document: Document): Promise<void> {
    PapDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    }).objects.unshift(this.object)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}
