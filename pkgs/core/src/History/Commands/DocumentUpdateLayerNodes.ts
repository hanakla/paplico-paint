import { Delta, diff, patch, unpatch } from 'jsondiffpatch'
import { ICommand } from '../ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@/utils/object'
import { VisuElement } from '@/Document'

type Changes = {
  add?: Array<{
    visu: VisuElement.AnyElement
    parentNodePath: string[]
    /** -1 to top of layer  */
    indexInNode?: number | undefined
  }>
  remove?: Array<string[]>
}

type LayerNodePointer = {
  visu: VisuElement.AnyElement
  path: string[]
  index: number
}

export class DocumentUpdateLayerNodes implements ICommand {
  public readonly name = 'DocumentUpdateLayerNodes'

  protected changes: Changes = {}
  protected deletedVisues: VisuElement.AnyElement[] = []
  protected changesPatch: Delta | null = null

  constructor(changes: Changes) {
    this.changes = changes
  }

  public async do(docx: DocumentContext): Promise<void> {
    const original = deepClone(docx.layerTreeRoot)

    this.changes.add?.forEach(({ visu, parentNodePath, indexInNode }) => {
      docx.document.layerNodes.addLayerNode(visu, parentNodePath, indexInNode)
    })

    this.changes.remove?.forEach((nodePath) => {
      docx.document.layerNodes.removeNodeAt(nodePath)
    })

    this.changesPatch = diff(original, docx.layerTreeRoot)!
  }

  public async undo(document: DocumentContext): Promise<void> {
    if (!this.changesPatch) return

    unpatch(document.layerTreeRoot, this.changesPatch)
  }

  public async redo(document: DocumentContext): Promise<void> {
    patch(document.layerTreeRoot, this.changesPatch)
  }

  get effectedVisuUids() {
    return []
  }
}
