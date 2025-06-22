/**
 * 複数のArtObjectを同時に移動するコマンド
 */

import type { Document } from '../document/document'
import type { UUID } from '../document/types'
import { generateUid } from '../document/utils'
import type { DocumentManager } from '../document-manager'
import type { Vector2 } from '../state'
import { debugState } from '../webgpu/core-engine'
import type { ICommand } from './base'

export interface MoveArtObjectsCommandParams {
  artObjectIds: string[]
  offset: Vector2
  originalPositions?: Map<string, Vector2>
}

export class MoveArtObjectsCommand implements ICommand {
  readonly id: UUID
  readonly type = 'move-art-objects'
  readonly timestamp: Date

  private params: MoveArtObjectsCommandParams
  private documentManager: DocumentManager

  constructor(
    params: MoveArtObjectsCommandParams,
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

  execute(document: Document): void {
    if (!document) {
      const errorMessage = 'No document provided for MoveArtObjectsCommand'

      // debugStateに失敗を記録
      debugState.movement.lastMoveCommand.timestamp = Date.now()
      debugState.movement.lastMoveCommand.objectIds = this.params.artObjectIds
      debugState.movement.lastMoveCommand.offset = this.params.offset
      debugState.movement.lastMoveCommand.success = false
      debugState.movement.lastMoveCommand.errorMessage = errorMessage

      debugState.movement.executionLog.push({
        timestamp: Date.now(),
        action: 'execute_command',
        data: { error: errorMessage },
      })

      throw new Error(errorMessage)
    }

    // debugStateに実行開始を記録
    debugState.movement.lastMoveCommand.timestamp = Date.now()
    debugState.movement.lastMoveCommand.objectIds = [
      ...this.params.artObjectIds,
    ]
    debugState.movement.lastMoveCommand.offset = { ...this.params.offset }
    debugState.movement.lastMoveCommand.success = false
    debugState.movement.lastMoveCommand.errorMessage = null

    debugState.movement.executionLog.push({
      timestamp: Date.now(),
      action: 'execute_command',
      data: {
        objectIds: this.params.artObjectIds,
        offset: this.params.offset,
      },
    })

    // 元の位置を保存（undo用）
    if (!this.params.originalPositions) {
      this.params.originalPositions = new Map()
      debugState.movement.objectTransforms.before = {}

      for (const artObjectId of this.params.artObjectIds) {
        const artObject = document.artObjects[artObjectId]
        if (artObject?.transform) {
          const originalPos = {
            x: artObject.transform.x,
            y: artObject.transform.y,
          }
          this.params.originalPositions.set(artObjectId, originalPos)
          debugState.movement.objectTransforms.before[artObjectId] = originalPos
        }
      }
    }

    // 各オブジェクトを移動
    let movedCount = 0
    debugState.movement.objectTransforms.after = {}

    for (const artObjectId of this.params.artObjectIds) {
      const artObject = document.artObjects[artObjectId]
      if (!artObject || !artObject.transform) {
        debugState.movement.executionLog.push({
          timestamp: Date.now(),
          action: 'object_moved',
          data: {
            objectId: artObjectId,
            error: 'Could not find artObject or transform',
            artObjectExists: !!artObject,
            transformExists: !!artObject?.transform,
          },
        })
        continue
      }

      const oldX = artObject.transform.x
      const oldY = artObject.transform.y

      // transformプロパティを直接更新
      artObject.transform.x += this.params.offset.x
      artObject.transform.y += this.params.offset.y

      const newPos = { x: artObject.transform.x, y: artObject.transform.y }
      debugState.movement.objectTransforms.after[artObjectId] = newPos

      debugState.movement.executionLog.push({
        timestamp: Date.now(),
        action: 'object_moved',
        data: {
          objectId: artObjectId,
          from: { x: oldX, y: oldY },
          to: newPos,
          offset: this.params.offset,
        },
      })

      movedCount++
    }

    // debugStateに成功を記録
    debugState.movement.lastMoveCommand.success = movedCount > 0
    debugState.movement.objectTransforms.lastUpdateTime = Date.now()

    if (movedCount === 0) {
      debugState.movement.lastMoveCommand.errorMessage = 'No objects were moved'
    }

    // ドキュメントの更新日時を更新
    document.updatedAt = new Date()
  }

  undo(document: Document): void {
    if (!document || !this.params.originalPositions) {
      throw new Error('Cannot undo: missing document or original positions')
    }

    // 元の位置に復元
    for (const artObjectId of this.params.artObjectIds) {
      const artObject = document.artObjects[artObjectId]
      const originalPos = this.params.originalPositions.get(artObjectId)

      if (artObject?.transform && originalPos) {
        artObject.transform.x = originalPos.x
        artObject.transform.y = originalPos.y
      }
    }

    // ドキュメントの更新日時を更新
    document.updatedAt = new Date()
  }

  getDescription(): string {
    const count = this.params.artObjectIds.length
    return `Move ${count} object${
      count > 1 ? 's' : ''
    } by (${this.params.offset.x.toFixed(1)}, ${this.params.offset.y.toFixed(
      1,
    )})`
  }
}
