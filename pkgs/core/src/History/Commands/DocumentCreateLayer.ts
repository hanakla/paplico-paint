import { LayerEntity, getLayerNodeAt } from '@/Document'
import { ICommand } from '../ICommand'
import { RuntimeDocument } from '@/Engine'

export class DocumentCreateLayer implements ICommand {
  public readonly name = 'DocumentCreateLayer'

  protected layer: LayerEntity
  protected layerPath: string[] = []
  protected indexAtSibling = -1

  constructor(
    addingLayer: LayerEntity,
    {
      layerPath,
      indexAtSibling,
    }: { layerPath: string[]; indexAtSibling: number },
  ) {
    this.layer = addingLayer
    this.layerPath = layerPath
    this.indexAtSibling = indexAtSibling
  }

  public async do(document: RuntimeDocument): Promise<void> {
    document.document.addLayer(this.layer, this.layerPath, this.indexAtSibling)
  }

  public async undo(document: RuntimeDocument): Promise<void> {
    const parent = document.document.resolveNodePath(this.layerPath)
    if (!parent) throw new Error('Parent not found')

    parent.children.splice(
      parent.children.findIndex((node) => node.layerUid === this.layer.uid),
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
