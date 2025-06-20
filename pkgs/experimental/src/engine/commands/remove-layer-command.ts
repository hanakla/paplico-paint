import { Document } from '../document/document'
import { UUID } from '../document/types'
import { BaseCommand } from './base'

/**
 * レイヤー削除コマンド
 */
export interface RemoveLayerCommandParams {
  layerId: UUID
}

export class RemoveLayerCommand extends BaseCommand {
  public readonly type = 'removeLayer'
  private params: RemoveLayerCommandParams
  private savedLayerData: any = null
  private savedNodeData: any = null

  constructor(params: RemoveLayerCommandParams) {
    super()
    this.params = params
  }

  execute(document: Document): void {
    // データを保存してから削除
    this.savedLayerData = document.layers[this.params.layerId]
    this.savedNodeData = document.layerNodes.find(
      (node) => node.layerId === this.params.layerId,
    )

    delete document.layers[this.params.layerId]
    const nodeIndex = document.layerNodes.findIndex(
      (node) => node.layerId === this.params.layerId,
    )
    if (nodeIndex !== -1) {
      document.layerNodes.splice(nodeIndex, 1)
    }
    document.updatedAt = new Date()
  }

  undo(document: Document): void {
    if (this.savedLayerData && this.savedNodeData) {
      document.layers[this.params.layerId] = this.savedLayerData
      document.layerNodes.push(this.savedNodeData)
      document.updatedAt = new Date()
    }
  }

  getDescription(): string {
    return `レイヤー削除: ${this.savedLayerData?.name || this.params.layerId}`
  }
}
