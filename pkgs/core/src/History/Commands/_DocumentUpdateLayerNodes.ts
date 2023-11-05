import { Delta, diff, unpatch } from 'jsondiffpatch'
import { ICommand } from '../ICommand'
import { DocumentContext } from '@/Engine'
import { deepClone } from '@/utils/object'
import { LayerNode, VisuElement } from '@/Document'

export class DocumentUpdateLayerNodes implements ICommand {
  public readonly name = 'DocumentUpdateLayerNodes'

  protected updater: (rootNode: LayerNode) => void
  protected deletedVisues: VisuElement.AnyElement[] = []
  protected changesPatch: Delta | null = null

  constructor(updater: (rootNode: LayerNode) => void) {
    this.updater = updater
  }

  public async do(docx: DocumentContext): Promise<void> {
    const original = deepClone(docx.layerTreeRoot)
    const next = deepClone(original)
    this.updater(next)

    this.changesPatch = diff(original, next)!
    docx.layerTreeRoot.children = next.children

    console.log('do', this.changesPatch)
  }

  public async undo(document: DocumentContext): Promise<void> {
    if (!this.changesPatch) return

    unpatch(document.layerTreeRoot, this.changesPatch)
  }

  public async redo(document: DocumentContext): Promise<void> {
    return this.do(document)
  }

  get effectedVisuUids() {
    return []
  }
}
