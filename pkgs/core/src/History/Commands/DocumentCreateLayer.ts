import { LayerEntity, getLayerNodeAt } from '@/Document'
import { ICommand } from '../ICommand'
import { RuntimeDocument } from '@/Engine'

export class DocumentCreateLayer implements ICommand {
  public readonly name = 'DocumentCreateLayer'

  protected layer: LayerEntity
  protected nodeAt: string[] = []

  constructor(layer: LayerEntity, { nodeAt }: { nodeAt: string[] }) {
    this.layer = layer
    this.nodeAt = nodeAt
  }

  public async do(document: RuntimeDocument): Promise<void> {
    document.document.layerEntities.push(this.layer)

    const parent = getLayerNodeAt(document, this.nodeAt)
    parent.push({
      layerUid: this.layer.uid,
      children: [],
    })
  }

  public async undo(document: RuntimeDocument): Promise<void> {
    document.document.layerEntities = document.document.layerEntities.filter(
      (layer) => layer.uid !== this.layer.uid,
    )

    const parent = getLayerNodeAt(document.document, this.nodeAt)
    parent.splice(
      parent.findIndex((node) => node.layerUid === this.layer.uid),
      1,
    )
  }

  public async redo(document: RuntimeDocument): Promise<void> {
    return this.do(document)
  }

  get effectedLayers() {
    return [this.layer.uid]
  }
}
