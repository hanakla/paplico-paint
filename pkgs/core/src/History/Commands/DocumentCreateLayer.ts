import { LayerEntity, PaplicoDocument, getLayerNodeAt } from '@/Document'
import { ICommand } from '../ICommand'

export class DocumentCreateLayer implements ICommand {
  public readonly name = 'DocumentCreateLayer'

  protected layer: LayerEntity
  protected nodeAt: string[] = []

  constructor(layer: LayerEntity, { nodeAt }: { nodeAt: string[] }) {
    this.layer = layer
    this.nodeAt = nodeAt
  }

  public async do(document: PaplicoDocument): Promise<void> {
    this.redo(document)
  }

  public async undo(document: PaplicoDocument): Promise<void> {
    document.layerEntities = document.layerEntities.filter(
      (layer) => layer.uid !== this.layer.uid
    )

    const parent = getLayerNodeAt(document, this.nodeAt)
    parent.splice(
      parent.findIndex((node) => node.layerUid === this.layer.uid),
      1
    )
  }

  public async redo(document: PaplicoDocument): Promise<void> {
    document.layerEntities.push(this.layer)

    const parent = getLayerNodeAt(document, this.nodeAt)
    parent.push({
      layerUid: this.layer.uid,
      children: [],
    })
  }

  get effectedLayers() {
    return [this.layer.uid]
  }
}
