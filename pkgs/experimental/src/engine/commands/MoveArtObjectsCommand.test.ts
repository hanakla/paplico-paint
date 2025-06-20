/**
 * MoveArtObjectsCommandのテスト
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MoveArtObjectsCommand } from './MoveArtObjectsCommand'
import { DocumentManager } from '../document-manager'
import { Document } from '../document/document'
import { createPathArtObject } from '../document/art-object'
import { createVectorLayer } from '../document/layer'
import { generateUid } from '../document/utils'
import { createVectorPath } from '../state'

describe('MoveArtObjectsCommand', () => {
  let documentManager: DocumentManager
  let document: Document
  let artObjectId1: string
  let artObjectId2: string

  beforeEach(() => {
    documentManager = new DocumentManager()

    // テスト用ドキュメントを作成
    const vectorLayer = createVectorLayer({
      name: 'Test Layer',
    })

    const path1 = createVectorPath([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
    ])

    const path2 = createVectorPath([
      { x: 300, y: 300 },
      { x: 400, y: 300 },
      { x: 400, y: 400 },
    ])

    const artObject1 = createPathArtObject({
      layerId: vectorLayer.id,
      path: path1,
      appearances: [],
    })

    const artObject2 = createPathArtObject({
      layerId: vectorLayer.id,
      path: path2,
      appearances: [],
    })

    // 初期位置を設定
    artObject1.transform = { x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1 }
    artObject2.transform = { x: 150, y: 150, rotation: 0, scaleX: 1, scaleY: 1 }

    artObjectId1 = artObject1.id
    artObjectId2 = artObject2.id

    document = {
      id: generateUid(),
      name: 'Test Document',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      layers: {
        [vectorLayer.id]: vectorLayer,
      },
      layerTree: {
        id: 'root',
        parentId: null,
        order: 0,
        type: 'group',
        childLayerIds: [vectorLayer.id],
      },
      artObjects: {
        [artObjectId1]: artObject1,
        [artObjectId2]: artObject2,
      },
      artboards: {},
      activeLayerId: vectorLayer.id,
      canvasSettings: {
        width: 1920,
        height: 1080,
        backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
      },
    }

    // DocumentManagerにドキュメントを追加
    documentManager.loadDocument(document)
    documentManager.setActiveDocument(document.id)
  })

  describe('execute', () => {
    it('should move single art object by specified offset', () => {
      const offset = { x: 10, y: 20 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )

      const originalX = document.artObjects[artObjectId1].transform.x
      const originalY = document.artObjects[artObjectId1].transform.y

      command.execute(document)

      expect(document.artObjects[artObjectId1].transform.x).toBe(
        originalX + offset.x,
      )
      expect(document.artObjects[artObjectId1].transform.y).toBe(
        originalY + offset.y,
      )
    })

    it('should move multiple art objects by specified offset', () => {
      const offset = { x: 25, y: -15 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1, artObjectId2], offset },
        documentManager,
      )

      const original1X = document.artObjects[artObjectId1].transform.x
      const original1Y = document.artObjects[artObjectId1].transform.y
      const original2X = document.artObjects[artObjectId2].transform.x
      const original2Y = document.artObjects[artObjectId2].transform.y

      command.execute(document)

      expect(document.artObjects[artObjectId1].transform.x).toBe(
        original1X + offset.x,
      )
      expect(document.artObjects[artObjectId1].transform.y).toBe(
        original1Y + offset.y,
      )
      expect(document.artObjects[artObjectId2].transform.x).toBe(
        original2X + offset.x,
      )
      expect(document.artObjects[artObjectId2].transform.y).toBe(
        original2Y + offset.y,
      )
    })

    it('should save original positions for undo', () => {
      const offset = { x: 10, y: 20 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )

      const originalX = document.artObjects[artObjectId1].transform.x
      const originalY = document.artObjects[artObjectId1].transform.y

      command.execute(document)

      // @ts-ignore - accessing private property for testing
      const savedPos = command.params.originalPositions?.get(artObjectId1)
      expect(savedPos).toEqual({ x: originalX, y: originalY })
    })

    it('should update document updatedAt timestamp', async () => {
      const offset = { x: 5, y: 5 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )

      const originalTimestamp = document.updatedAt

      await new Promise((resolve) => setTimeout(resolve, 1))
      command.execute(document)
      expect(document.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalTimestamp.getTime(),
      )
    })

    it('should handle non-existent art objects gracefully', () => {
      const offset = { x: 10, y: 10 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: ['non-existent-id'], offset },
        documentManager,
      )

      expect(() => command.execute(document)).not.toThrow()
    })

    it('should throw error when no document provided', () => {
      const offset = { x: 10, y: 10 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )

      expect(() => command.execute(null as any)).toThrow(
        'No document provided for MoveArtObjectsCommand',
      )
    })
  })

  describe('undo', () => {
    it('should restore original positions after move', () => {
      const offset = { x: 30, y: -20 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1, artObjectId2], offset },
        documentManager,
      )

      const original1X = document.artObjects[artObjectId1].transform.x
      const original1Y = document.artObjects[artObjectId1].transform.y
      const original2X = document.artObjects[artObjectId2].transform.x
      const original2Y = document.artObjects[artObjectId2].transform.y

      // 実行して移動
      command.execute(document)

      // 位置が変更されていることを確認
      expect(document.artObjects[artObjectId1].transform.x).toBe(
        original1X + offset.x,
      )
      expect(document.artObjects[artObjectId1].transform.y).toBe(
        original1Y + offset.y,
      )

      // undo実行
      command.undo(document)

      // 元の位置に戻っていることを確認
      expect(document.artObjects[artObjectId1].transform.x).toBe(original1X)
      expect(document.artObjects[artObjectId1].transform.y).toBe(original1Y)
      expect(document.artObjects[artObjectId2].transform.x).toBe(original2X)
      expect(document.artObjects[artObjectId2].transform.y).toBe(original2Y)
    })

    it('should throw error when original positions not saved', () => {
      const offset = { x: 10, y: 10 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )

      expect(() => command.undo(document)).toThrow(
        'Cannot undo: missing document or original positions',
      )
    })

    it('should throw error when no document provided', () => {
      const offset = { x: 10, y: 10 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )

      command.execute(document)
      expect(() => command.undo(null as any)).toThrow(
        'Cannot undo: missing document or original positions',
      )
    })
  })

  describe('canUndo', () => {
    it('should always return true', () => {
      const offset = { x: 10, y: 10 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )

      expect(command.canUndo()).toBe(true)
    })
  })

  describe('getDescription', () => {
    it('should return correct description for single object', () => {
      const offset = { x: 10.5, y: 20.7 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )

      expect(command.getDescription()).toBe('Move 1 object by (10.5, 20.7)')
    })

    it('should return correct description for multiple objects', () => {
      const offset = { x: -5.2, y: 15.8 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1, artObjectId2], offset },
        documentManager,
      )

      expect(command.getDescription()).toBe('Move 2 objects by (-5.2, 15.8)')
    })
  })

  describe('command properties', () => {
    it('should have correct type', () => {
      const offset = { x: 10, y: 10 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )

      expect(command.type).toBe('move-art-objects')
    })

    it('should have unique id', () => {
      const offset = { x: 10, y: 10 }
      const command1 = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )
      const command2 = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )

      expect(command1.id).not.toBe(command2.id)
    })

    it('should have timestamp', () => {
      const offset = { x: 10, y: 10 }
      const command = new MoveArtObjectsCommand(
        { artObjectIds: [artObjectId1], offset },
        documentManager,
      )

      expect(command.timestamp).toBeInstanceOf(Date)
    })
  })
})
