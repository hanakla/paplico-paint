import { Delta, diff, patch, unpatch } from 'jsondiffpatch'
import { ICommand } from '../Engine/History/ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@paplico/shared-lib'
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
  protected effectedVisuUidSet = new Set<string>()

  constructor(changes: Changes) {
    this.changes = changes
  }

  public async do(docx: DocumentContext): Promise<void> {
    const original = deepClone(docx.layerTreeRoot)

    this.changes.add?.forEach(({ visu, parentNodePath, indexInNode }) => {
      this.effectedVisuUidSet.add(visu.uid)
      docx.document.layerNodes.addLayerNode(visu, parentNodePath, indexInNode)
    })

    this.changes.remove?.forEach((nodePath) => {
      if (!docx.document.layerNodes.getNodeAtPath(nodePath)) return

      this.effectedVisuUidSet.add(nodePath[nodePath.length - 1])
      docx.document.layerNodes.removeLayerNode(nodePath)
    })

    this.changes.move?.forEach(({ sourceNodePath, targetNodePath }) => {
      if (!docx.document.layerNodes.getNodeAtPath(sourceNodePath)) return

      const visuUid = sourceNodePath[sourceNodePath.length - 1]
      this.effectedVisuUidSet.add(visuUid)
      const { newPath } = docx.document.layerNodes.moveLayerNodeOver(
        sourceNodePath,
        targetNodePath,
      )

      if (docx.strokingTarget?.visuUid === visuUid) {
        docx.setStrokingTarget(newPath)
      }
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
    return [...this.effectedVisuUidSet]
  }
}
