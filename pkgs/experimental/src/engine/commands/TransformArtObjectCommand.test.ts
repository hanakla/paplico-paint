/**
 * TransformArtObjectCommandのテスト
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TransformArtObjectCommand } from './TransformArtObjectCommand'
import { DocumentManager } from '../document-manager'
import { Document } from '../document/document'
import { createPathArtObject } from '../document/art-object'
import { createVectorLayer } from '../document/layer'
import { generateUid } from '../document/utils'
import { createVectorPath } from '../state'

describe('TransformArtObjectCommand', () => {
  let documentManager: DocumentManager
  let document: Document
  let artObjectId: string

  beforeEach(() => {
    documentManager = new DocumentManager()

    // テスト用ドキュメントを作成
    const vectorLayer = createVectorLayer({
      name: 'Test Layer',
    })

    const path = createVectorPath([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
    ])

    const artObject = createPathArtObject({
      layerId: vectorLayer.id,
      path: path,
      appearances: [],
    })

    // 初期transform設定
    artObject.transform = { x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1 }

    artObjectId = artObject.id

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
        [artObjectId]: artObject,
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
    it('should apply transform changes to art object', () => {
      const newTransform = { x: 100, y: 150, rotation: 45 }
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      const originalTransform = {
        ...document.artObjects[artObjectId].transform,
      }

      command.execute(document)

      const updatedTransform = document.artObjects[artObjectId].transform
      expect(updatedTransform.x).toBe(100)
      expect(updatedTransform.y).toBe(150)
      expect(updatedTransform.rotation).toBe(45)
      expect(updatedTransform.scaleX).toBe(originalTransform.scaleX) // unchanged
      expect(updatedTransform.scaleY).toBe(originalTransform.scaleY) // unchanged
    })

    it('should save original transform for undo', () => {
      const newTransform = { x: 200, scaleX: 2 }
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      const originalTransform = {
        ...document.artObjects[artObjectId].transform,
      }

      command.execute(document)

      // @ts-ignore - accessing private property for testing
      expect(command.params.oldTransform).toEqual(originalTransform)
    })

    it('should update document updatedAt timestamp', async () => {
      const newTransform = { rotation: 90 }
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      const originalTimestamp = document.updatedAt

      await new Promise((resolve) => setTimeout(resolve, 1))
      command.execute(document)
      expect(document.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalTimestamp.getTime(),
      )
    })

    it('should throw error when no document provided', () => {
      const newTransform = { x: 100 }
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      expect(() => command.execute(null as any)).toThrow(
        'No document provided for TransformArtObjectCommand',
      )
    })

    it('should throw error when art object not found', () => {
      const newTransform = { x: 100 }
      const command = new TransformArtObjectCommand(
        { artObjectId: 'non-existent-id', newTransform },
        documentManager,
      )

      expect(() => command.execute(document)).toThrow(
        'ArtObject with ID non-existent-id not found',
      )
    })

    it('should apply partial transform changes', () => {
      const newTransform = { scaleY: 0.5 } // only change scaleY
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      const originalTransform = {
        ...document.artObjects[artObjectId].transform,
      }

      command.execute(document)

      const updatedTransform = document.artObjects[artObjectId].transform
      expect(updatedTransform.x).toBe(originalTransform.x) // unchanged
      expect(updatedTransform.y).toBe(originalTransform.y) // unchanged
      expect(updatedTransform.rotation).toBe(originalTransform.rotation) // unchanged
      expect(updatedTransform.scaleX).toBe(originalTransform.scaleX) // unchanged
      expect(updatedTransform.scaleY).toBe(0.5) // changed
    })
  })

  describe('undo', () => {
    it('should restore original transform', () => {
      const newTransform = {
        x: 300,
        y: 400,
        rotation: 180,
        scaleX: 2,
        scaleY: 0.5,
      }
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      const originalTransform = {
        ...document.artObjects[artObjectId].transform,
      }

      // 実行
      command.execute(document)

      // 変更されていることを確認
      const changedTransform = document.artObjects[artObjectId].transform
      expect(changedTransform.x).toBe(300)
      expect(changedTransform.y).toBe(400)
      expect(changedTransform.rotation).toBe(180)

      // undo実行
      command.undo(document)

      // 元に戻っていることを確認
      const restoredTransform = document.artObjects[artObjectId].transform
      expect(restoredTransform).toEqual(originalTransform)
    })

    it('should throw error when no document provided', () => {
      const newTransform = { x: 100 }
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      command.execute(document)
      expect(() => command.undo(null as any)).toThrow(
        'No document provided for TransformArtObjectCommand undo',
      )
    })

    it('should throw error when art object not found', () => {
      const newTransform = { x: 100 }
      const command = new TransformArtObjectCommand(
        { artObjectId: 'non-existent-id', newTransform },
        documentManager,
      )

      // executeはスキップしてundoを直接テスト
      expect(() => command.undo(document)).toThrow(
        'ArtObject with ID non-existent-id not found',
      )
    })

    it('should throw error when no old transform data', () => {
      const newTransform = { x: 100 }
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      // executeせずにundoを実行（oldTransformが保存されていない状態）
      expect(() => command.undo(document)).toThrow(
        'No old transform data for undo',
      )
    })
  })

  describe('canUndo', () => {
    it('should always return true', () => {
      const newTransform = { x: 100 }
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      expect(command.canUndo()).toBe(true)
    })
  })

  describe('getDescription', () => {
    it('should return correct description', () => {
      const newTransform = { x: 100 }
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      expect(command.getDescription()).toBe(
        `Transform ArtObject ${artObjectId}`,
      )
    })
  })

  describe('canMergeWith', () => {
    it('should return true for same art object within time limit', () => {
      const newTransform1 = { x: 100 }
      const newTransform2 = { y: 200 }

      const command1 = new TransformArtObjectCommand(
        { artObjectId, newTransform: newTransform1 },
        documentManager,
      )
      const command2 = new TransformArtObjectCommand(
        { artObjectId, newTransform: newTransform2 },
        documentManager,
      )

      expect(command1.canMergeWith(command2)).toBe(true)
    })

    it('should return false for different art objects', () => {
      const newTransform = { x: 100 }

      const command1 = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )
      const command2 = new TransformArtObjectCommand(
        { artObjectId: 'different-id', newTransform },
        documentManager,
      )

      expect(command1.canMergeWith(command2)).toBe(false)
    })

    it('should return false for different command types', () => {
      const newTransform = { x: 100 }
      const command1 = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      const otherCommand = {
        type: 'different-command',
        id: generateUid(),
        timestamp: new Date(),
        canUndo: () => true,
        execute: () => {},
        undo: () => {},
        getDescription: () => 'test',
      }

      expect(command1.canMergeWith(otherCommand)).toBe(false)
    })
  })

  describe('mergeWith', () => {
    it('should merge commands for same art object', () => {
      const newTransform1 = { x: 100, y: 200 }
      const newTransform2 = { x: 300, rotation: 45 }

      const command1 = new TransformArtObjectCommand(
        { artObjectId, newTransform: newTransform1 },
        documentManager,
      )

      // 最初のコマンドを実行してoldTransformを保存
      command1.execute(document)

      const command2 = new TransformArtObjectCommand(
        { artObjectId, newTransform: newTransform2 },
        documentManager,
      )

      const mergedCommand = command1.mergeWith(command2)

      expect(mergedCommand).not.toBeNull()
      expect(mergedCommand).toBeInstanceOf(TransformArtObjectCommand)

      // @ts-ignore - accessing private property for testing
      expect(mergedCommand.params.newTransform).toEqual(newTransform2)
      // @ts-ignore - accessing private property for testing
      expect(mergedCommand.params.oldTransform).toEqual(
        command1.params.oldTransform,
      )
    })

    it('should return null when cannot merge', () => {
      const newTransform = { x: 100 }
      const command1 = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )
      const command2 = new TransformArtObjectCommand(
        { artObjectId: 'different-id', newTransform },
        documentManager,
      )

      expect(command1.mergeWith(command2)).toBeNull()
    })
  })

  describe('command properties', () => {
    it('should have correct type', () => {
      const newTransform = { x: 100 }
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      expect(command.type).toBe('transform-art-object')
    })

    it('should have unique id', () => {
      const newTransform = { x: 100 }
      const command1 = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )
      const command2 = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      expect(command1.id).not.toBe(command2.id)
    })

    it('should have timestamp', () => {
      const newTransform = { x: 100 }
      const command = new TransformArtObjectCommand(
        { artObjectId, newTransform },
        documentManager,
      )

      expect(command.timestamp).toBeInstanceOf(Date)
    })
  })
})
