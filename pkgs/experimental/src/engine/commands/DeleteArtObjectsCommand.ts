/**
 * アートオブジェクト削除コマンド
 */

import { DocumentManager } from '../document-manager'
import { ICommand } from './base'
import { UUID } from '../document/types'
import { ArtObject } from '../document/art-object'
import { Document } from '../document/document'
import { generateUid } from '../document/utils'

export interface DeleteArtObjectsCommandParams {
  artObjectIds: string[]
}

export class DeleteArtObjectsCommand implements ICommand {
  public readonly id: UUID
  public readonly type = 'delete-art-objects'
  public readonly timestamp: Date
  private params: DeleteArtObjectsCommandParams
  private documentManager: DocumentManager
  private deletedObjects: Map<string, ArtObject> = new Map()
  private deletedObjectLayerIds: Map<string, string> = new Map()

  constructor(
    params: DeleteArtObjectsCommandParams,
    documentManager: DocumentManager,
  ) {
    this.id = generateUid()
    this.timestamp = new Date()
    this.params = params
    this.documentManager = documentManager
  }

  canUndo(): boolean {
    return true
  }

  canRedo(): boolean {
    return true
  }

  getDescription(): string {
    const count = this.params.artObjectIds.length
    return count === 1 ? 'オブジェクトを削除' : `${count}個のオブジェクトを削除`
  }

  execute(document: Document): void {
    if (!document) {
      throw new Error('ドキュメントが指定されていません')
    }

    // 削除前にオブジェクトとその所属レイヤーを保存
    for (const artObjectId of this.params.artObjectIds) {
      const artObject = document.artObjects[artObjectId]
      if (artObject) {
        this.deletedObjects.set(artObjectId, { ...artObject })

        // オブジェクトが所属しているレイヤーを見つける
        for (const [layerId, layer] of Object.entries(document.layers)) {
          if (
            layer.type === 'vector' &&
            layer.artObjectIds?.includes(artObjectId)
          ) {
            this.deletedObjectLayerIds.set(artObjectId, layerId)
            break
          }
        }
      }
    }

    // オブジェクトを削除
    for (const artObjectId of this.params.artObjectIds) {
      // ドキュメントから削除
      delete document.artObjects[artObjectId]

      // レイヤーからも削除
      const layerId = this.deletedObjectLayerIds.get(artObjectId)
      if (layerId) {
        const layer = document.layers[layerId]
        if (layer && layer.type === 'vector' && layer.artObjectIds) {
          layer.artObjectIds = layer.artObjectIds.filter(
            (id) => id !== artObjectId,
          )
        }
      }
    }

    // ドキュメントの更新日時を更新
    document.updatedAt = new Date()
  }

  undo(document: Document): void {
    if (!document) {
      throw new Error('ドキュメントが指定されていません')
    }

    // 削除されたオブジェクトを復元
    for (const [artObjectId, artObject] of this.deletedObjects) {
      document.artObjects[artObjectId] = artObject

      // レイヤーにも復元
      const layerId = this.deletedObjectLayerIds.get(artObjectId)
      if (layerId) {
        const layer = document.layers[layerId]
        if (layer && layer.type === 'vector') {
          if (!layer.artObjectIds) {
            layer.artObjectIds = []
          }
          if (!layer.artObjectIds.includes(artObjectId)) {
            layer.artObjectIds.push(artObjectId)
          }
        }
      }
    }

    // ドキュメントの更新日時を更新
    document.updatedAt = new Date()
  }

  redo(document: Document): void {
    this.execute(document)
  }

  serialize(): any {
    return {
      type: 'DeleteArtObjectsCommand',
      id: this.id,
      timestamp: this.timestamp,
      params: this.params,
      deletedObjects: Array.from(this.deletedObjects.entries()),
      deletedObjectLayerIds: Array.from(this.deletedObjectLayerIds.entries()),
    }
  }

  static deserialize(
    data: any,
    documentManager: DocumentManager,
  ): DeleteArtObjectsCommand {
    const command = new DeleteArtObjectsCommand(data.params, documentManager)
    command.deletedObjects = new Map(data.deletedObjects || [])
    command.deletedObjectLayerIds = new Map(data.deletedObjectLayerIds || [])
    return command
  }
}
