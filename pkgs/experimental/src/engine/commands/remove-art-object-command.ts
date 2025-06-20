import { Document } from '../document/document'
import { UUID } from '../document/types'
import { BaseCommand } from './base'

/**
 * ArtObject削除コマンド
 */
export interface RemoveArtObjectCommandParams {
  artObjectId: UUID
}

export class RemoveArtObjectCommand extends BaseCommand {
  public readonly type = 'removeArtObject'
  private params: RemoveArtObjectCommandParams
  private savedArtObjectData: any = null

  constructor(params: RemoveArtObjectCommandParams) {
    super()
    this.params = params
  }

  execute(document: Document): void {
    this.savedArtObjectData = document.artObjects[this.params.artObjectId]
    if (!this.savedArtObjectData) return

    delete document.artObjects[this.params.artObjectId]

    // 所属レイヤーのartObjectIdsからも削除
    const layer = document.layers[this.savedArtObjectData.layerId]
    if (layer && layer.type === 'vector') {
      const index = layer.artObjectIds.indexOf(this.params.artObjectId)
      if (index !== -1) {
        layer.artObjectIds.splice(index, 1)
      }
    }

    document.updatedAt = new Date()
  }

  undo(document: Document): void {
    if (this.savedArtObjectData) {
      document.artObjects[this.params.artObjectId] = this.savedArtObjectData

      // 所属レイヤーのartObjectIdsにも追加
      const layer = document.layers[this.savedArtObjectData.layerId]
      if (layer && layer.type === 'vector') {
        layer.artObjectIds.push(this.params.artObjectId)
      }

      document.updatedAt = new Date()
    }
  }

  getDescription(): string {
    return `オブジェクト削除: ${
      this.savedArtObjectData?.type || this.params.artObjectId
    }`
  }
}
