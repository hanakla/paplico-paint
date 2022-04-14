import { SilkDOMDigger } from '../../SilkDOMDigger'
import { ICommand } from '../ICommand'
import {
  Document,
  LayerTypes,
  ReferenceLayer,
  VectorObject,
} from '../../SilkDOM'

export class ReferenceConvertToSubstance implements ICommand {
  private referenceLayer: ReferenceLayer
  private sourceLayer!: LayerTypes
  private clonedLayer!: LayerTypes

  constructor({ referenceLayer }: { referenceLayer: ReferenceLayer }) {
    this.referenceLayer = referenceLayer
  }

  async do(document: Document) {
    const layer = SilkDOMDigger.findLayerRecursive(
      document,
      this.referenceLayer.uid,
      { strict: true }
    )

    this.clonedLayer = layer.clone()
  }

  async undo(document: Document): Promise<void> {
    document.update((d) => {
      let path = SilkDOMDigger.getPathToLayer(document, this.clonedLayer.uid, {
        strict: true,
      })!.slice(0, -1)

      const parent = SilkDOMDigger.findLayerParent(d, path)
      const index = parent.layers.findIndex(
        (l) => l.uid === this.clonedLayer.uid
      )
      if (index === -1) return

      parent.layers.splice(1, index)
    })
  }

  async redo(document: Document): Promise<void> {
    SilkDOMDigger.findLayer(document, this.pathToTargetLayer, {
      kind: 'vector',
      strict: true,
    }).objects.unshift(this.object)
  }

  get effectedLayers(): string[][] {
    return [this.pathToTargetLayer]
  }
}
