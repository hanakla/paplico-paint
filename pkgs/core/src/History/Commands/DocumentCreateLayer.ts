import { LayerEntity } from '@/Document'
import { ICommand } from '../ICommand'
import { DocumentContext as PaplicoDocumentContext } from '@/Engine'

export class DocumentCreateLayer implements ICommand {
  public readonly name = 'DocumentCreateLayer'

  protected layer: LayerEntity
  protected nodePath: string[] = []
  protected indexAtSibling = -1

  constructor(
    addingLayer: LayerEntity,
    {
      nodePath,
      indexAtSibling,
    }: { nodePath: string[]; indexAtSibling: number },
  ) {
    this.layer = addingLayer
    this.nodePath = nodePath
    this.indexAtSibling = indexAtSibling
  }

  public async do(document: PaplicoDocumentContext): Promise<void> {
    document.document.addLayerNode(
      this.layer,
      this.nodePath,
      this.indexAtSibling,
    )
  }

  public async undo(document: PaplicoDocumentContext): Promise<void> {
    const parent = document.document.layerNodes.getNodeAtPath(this.nodePath)
    if (!parent) throw new Error('Parent not found')

    parent.children.splice(
      parent.children.findIndex((node) => node.visuUid === this.layer.uid),
      1,
    )
  }

  public async redo(document: PaplicoDocumentContext): Promise<void> {
    return this.do(document)
  }

  get effectedVisuUids() {
    return [this.layer.uid]
  }
}
