import { Delta, diff, patch, unpatch } from 'jsondiffpatch'
import { ICommand } from '../Engine/History/ICommand'
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
  move?: Array<{
    sourceNodePath: string[]
    targetNodePath: string[]
  }>
  remove?: Array<string[]>
}

type LayerNodePointer = {
  visu: VisuElement.AnyElement
  path: string[]
  index: number
}

export class DocumentManipulateLayerNodes implements ICommand {
  public readonly name = 'DocumentManipulateLayerNodes'

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
      docx.document.layerNodes.removeLayerNode(nodePath)
    })

    this.changes.move?.forEach(({ sourceNodePath, targetNodePath }) => {
      docx.document.layerNodes.moveLayerNodeOver(sourceNodePath, targetNodePath)
    })

    this.changesPatch = diff(original, docx.layerTreeRoot)!
  }

  public async undo(document: DocumentContext): Promise<void> {
    if (!this.changesPatch) return

    unpatch(document.layerTreeRoot, this.changesPatch)
  }

  public async redo(document: DocumentContext): Promise<void> {
    if (!this.changesPatch) return

    patch(document.layerTreeRoot, this.changesPatch)
  }

  get effectedVisuUids() {
    return []
  }
}
