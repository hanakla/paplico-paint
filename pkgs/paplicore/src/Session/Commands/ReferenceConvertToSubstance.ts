import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, LayerTypes, ReferenceLayer, VectorObject } from '../../DOM'

export class ReferenceConvertToSubstance implements ICommand {
  public readonly name = 'ReferenceConvertToSubstance'

  private pathToReference: string[]
  private clonedLayer!: LayerTypes

  constructor({ pathToReference }: { pathToReference: string[] }) {
    this.pathToReference = pathToReference
  }

  async do(document: Document) {
    const source = PapDOMDigger.findLayer(document, this.pathToReference, {
      kind: 'reference',
      strict: true,
    })

    const layer = PapDOMDigger.findLayerRecursive(
      document,
      source.referencedLayerId,
      { strict: true }
    )

    this.clonedLayer = layer.clone()
  }

  async undo(document: Document): Promise<void> {
    document.update((d) => {
      const path = PapDOMDigger.getPathToLayer(document, this.clonedLayer.uid, {
        strict: true,
      })

      const parent = PapDOMDigger.findLayerParent(d, path, { strict: true })
      const index = parent.layers.findIndex(
        (l) => l.uid === this.clonedLayer.uid
      )
      if (index === -1) return

      parent.update((l) => {
        l.layers.splice(1, index)
      })

      this.clonedLayer = null as any
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
