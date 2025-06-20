import { Document } from '../document/document'
import { UUID } from '../document/types'
import { BaseCommand } from './base'

/**
 * ArtObject追加コマンド
 */
export interface AddArtObjectCommandParams {
  artObjectId: UUID
  artObjectData: any
}

export class AddArtObjectCommand extends BaseCommand {
  public readonly type = 'addArtObject'
  private params: AddArtObjectCommandParams

  constructor(params: AddArtObjectCommandParams) {
    super()
    this.params = params
  }

  execute(document: Document): void {
    document.artObjects[this.params.artObjectId] = this.params.artObjectData

    // 所属レイヤーのartObjectIdsに追加
    const layer = document.layers[this.params.artObjectData.layerId]
    if (layer && layer.type === 'vector') {
      layer.artObjectIds.push(this.params.artObjectId)
    }

    document.updatedAt = new Date()
  }

  undo(document: Document): void {
    delete document.artObjects[this.params.artObjectId]

    // 所属レイヤーのartObjectIdsからも削除
    const layer = document.layers[this.params.artObjectData.layerId]
    if (layer && layer.type === 'vector') {
      const index = layer.artObjectIds.indexOf(this.params.artObjectId)
      if (index !== -1) {
        layer.artObjectIds.splice(index, 1)
      }
    }

    document.updatedAt = new Date()
  }

  getDescription(): string {
    return `オブジェクト追加: ${this.params.artObjectData.type}`
  }
}
