import { PapDOMDigger } from '../../PapDOMDigger'
import { ICommand } from '../ICommand'
import { Document, LayerTypes } from '../../DOM'

export class LayerDuplicate implements ICommand {
  public readonly name = 'LayerDuplicate'

  private pathToSourceLayer: string[]
  private cloned: LayerTypes | null = null

  constructor({ pathToSourceLayer }: { pathToSourceLayer: string[] }) {
    this.pathToSourceLayer = pathToSourceLayer
  }

  async do(document: Document) {
    const parent = PapDOMDigger.findLayerParent(
      document,
      this.pathToSourceLayer,
      { strict: true }
    )

    const layer = PapDOMDigger.findLayer(document, this.pathToSourceLayer, {
      strict: true,
    })

    this.cloned = layer.clone()

    parent.update((l) => {
      const [layerUid] = this.pathToSourceLayer.slice(-1)
      const index = l.layers.findIndex((l) => l.uid === layerUid)

      l.layers.splice(index + 1, 0, this.cloned)
    })
  }

  async undo(document: Document): Promise<void> {
    const parent = PapDOMDigger.findLayerParent(
      document,
      this.pathToSourceLayer,
      {
        strict: true,
      }
    )!

    parent.update((l) => {
      const idx = l.layers.findIndex((l) => l.uid === this.cloned.uid)!
      l.layers.splice(idx, 1)
      this.cloned = null
    })
  }

  async redo(document: Document): Promise<void> {
    await this.do(document)
  }

  get effectedLayers(): string[][] {
    return [this.pathToSourceLayer]
  }
}
