import { ICommand } from '@/History/ICommand'
import { DocumentContext } from '@/Engine'
import { LayerNode, VisuElement } from '@/Document'
import { rescue } from '@/utils/rescue'
import { PaplicoIgnoreableError } from '@/Errors'
import { PaplicoError } from '@/Errors/PaplicoError'

type NodeLocation = {
  path: string[]
  index: number
}

export class DocumentRemoveLayerNode implements ICommand {
  public readonly name = 'DocumentRemoveLayerNode'

  protected layerPaths: Array<string[]>

  protected nodeLocations: Record<string, NodeLocation> = {}
  protected removedNodes: LayerNode[] = []
  protected removedVisues: VisuElement.AnyElement[] = []

  public effectedVisuUids: string[] = []

  constructor(targetNodePaths: Array<string[]>) {
    this.layerPaths = targetNodePaths
  }

  public async do(docx: DocumentContext): Promise<void> {
    const nodeLocations: Record<string, NodeLocation> = {}
    const removedNodes: LayerNode[] = []
    const removedVisues: VisuElement.AnyElement[] = []
    const effected = new Set<string>()

    for (const path of this.layerPaths) {
      const result = rescue(
        () => {
          return docx.document.layerNodes.removeNodeAt(path)
        },
        { expects: [PaplicoIgnoreableError] },
      )

      if (result.success) {
        const visuUid = result.result.node.visuUid

        effected.add(visuUid)
        nodeLocations[visuUid] = {
          path: path.slice(0, -1),
          index: result.result.indexInParent,
        }
        removedNodes.push(result.result.node)
        removedVisues.push(result.result.visually)

        docx.invalidateLayerBitmapCache(visuUid)
      }
    }

    this.effectedVisuUids = [...effected]
    this.nodeLocations = nodeLocations
    this.removedNodes = removedNodes
    this.removedVisues = removedVisues
  }

  public async undo(docx: DocumentContext): Promise<void> {
    for (let idx = 0, l = this.removedNodes.length; idx < l; idx++) {
      const node = this.removedNodes[idx]
      const visu = this.removedVisues[idx]

      const { path, index } = this.nodeLocations[node.visuUid]
      const parent = docx.document.layerNodes.getNodeAtPath(path)
      if (!parent) throw new PaplicoError('Parent node not found')

      docx.document.visuElements.push(visu)
      docx.document.layerNodes.addLayerNode(visu, path, index)
    }
  }

  public async redo(document: DocumentContext): Promise<void> {
    this.do(document)
  }
}
