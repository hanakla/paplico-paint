import type { CanvasArtObject } from '../document/art-object'
import type { Document } from '../document/document'
import { BaseCommand } from './base'

/**
 * CanvasArtObject追加コマンド
 */
export interface AddCanvasArtObjectCommandParams {
  canvasArtObjectData: CanvasArtObject
  timestamp: Date
}

export class AddCanvasArtObjectCommand extends BaseCommand {
  public readonly type = 'addCanvasArtObject'
  private params: AddCanvasArtObjectCommandParams

  constructor(params: AddCanvasArtObjectCommandParams) {
    super()
    this.params = params
  }

  execute(document: Document): void {
    document.artObjects[this.params.canvasArtObjectData.id] =
      this.params.canvasArtObjectData

    // 所属レイヤーのartObjectIdsに追加
    const layer = this.params.canvasArtObjectData.layerId
      ? document.layers[this.params.canvasArtObjectData.layerId]
      : null
    if (layer && layer.type === 'vector') {
      layer.artObjectIds.push(this.params.canvasArtObjectData.id)
    } else {
    }

    document.updatedAt = this.params.timestamp
  }

  undo(document: Document): void {
    delete document.artObjects[this.params.canvasArtObjectData.id]

    // 所属レイヤーのartObjectIdsからも削除
    const layer = this.params.canvasArtObjectData.layerId
      ? document.layers[this.params.canvasArtObjectData.layerId]
      : null
    if (layer && layer.type === 'vector') {
      const index = layer.artObjectIds.indexOf(
        this.params.canvasArtObjectData.id,
      )
      if (index !== -1) {
        layer.artObjectIds.splice(index, 1)
      }
    }

    document.updatedAt = this.params.timestamp
  }

  getDescription(): string {
    return `Add canvas art object "${this.params.canvasArtObjectData.name}"`
  }
}
