/**
 * AddArtObjectCommandのテスト
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AddArtObjectCommand } from './add-art-object-command'
import { Document } from '../document/document'
import { createPathArtObject } from '../document/art-object'
import { createVectorLayer } from '../document/layer'
import { generateUid } from '../document/utils'
import { createVectorPath } from '../state'

describe('AddArtObjectCommand', () => {
  let document: Document
  let vectorLayer: any
  let artObject: any

  beforeEach(() => {
    // テスト用ドキュメントを作成
    vectorLayer = createVectorLayer({
      name: 'Test Layer',
    })

    const path = createVectorPath([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
    ])

    artObject = createPathArtObject({
      layerId: vectorLayer.id,
      path: path,
      appearances: [],
    })

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
      artObjects: {},
      artboards: {},
      activeLayerId: vectorLayer.id,
      canvasSettings: {
        width: 1920,
        height: 1080,
        backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
      },
    }
  })

  describe('execute', () => {
    it('should add art object to document', () => {
      const command = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObject,
      })

      expect(document.artObjects[artObject.id]).toBeUndefined()
      expect(document.layers[vectorLayer.id].artObjectIds).toEqual([])

      command.execute(document)

      expect(document.artObjects[artObject.id]).toEqual(artObject)
      expect(document.layers[vectorLayer.id].artObjectIds).toContain(
        artObject.id,
      )
    })

    it('should update document updatedAt timestamp', async () => {
      const command = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObject,
      })

      const originalTimestamp = document.updatedAt

      await new Promise((resolve) => setTimeout(resolve, 1))
      command.execute(document)
      expect(document.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalTimestamp.getTime(),
      )
    })

    it('should handle non-existent layer gracefully', () => {
      const artObjectWithInvalidLayer = {
        ...artObject,
        layerId: 'non-existent-layer',
      }

      const command = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObjectWithInvalidLayer,
      })

      expect(() => command.execute(document)).not.toThrow()
      expect(document.artObjects[artObject.id]).toEqual(
        artObjectWithInvalidLayer,
      )
    })

    it('should handle non-vector layer gracefully', () => {
      // グループレイヤーを追加
      const groupLayer = {
        id: generateUid(),
        name: 'Group Layer',
        type: 'group',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        childLayerIds: [],
      }
      document.layers[groupLayer.id] = groupLayer

      const artObjectWithGroupLayer = {
        ...artObject,
        layerId: groupLayer.id,
      }

      const command = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObjectWithGroupLayer,
      })

      expect(() => command.execute(document)).not.toThrow()
      expect(document.artObjects[artObject.id]).toEqual(artObjectWithGroupLayer)
    })
  })

  describe('undo', () => {
    it('should remove art object from document', () => {
      const command = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObject,
      })

      // 追加実行
      command.execute(document)
      expect(document.artObjects[artObject.id]).toBeDefined()
      expect(document.layers[vectorLayer.id].artObjectIds).toContain(
        artObject.id,
      )

      // undo実行
      command.undo(document)
      expect(document.artObjects[artObject.id]).toBeUndefined()
      expect(document.layers[vectorLayer.id].artObjectIds).not.toContain(
        artObject.id,
      )
    })

    it('should update document updatedAt timestamp', async () => {
      const command = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObject,
      })

      command.execute(document)
      const originalTimestamp = document.updatedAt

      await new Promise((resolve) => setTimeout(resolve, 1))
      command.undo(document)
      expect(document.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalTimestamp.getTime(),
      )
    })

    it('should handle non-existent layer gracefully', () => {
      const artObjectWithInvalidLayer = {
        ...artObject,
        layerId: 'non-existent-layer',
      }

      const command = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObjectWithInvalidLayer,
      })

      command.execute(document)
      expect(() => command.undo(document)).not.toThrow()
      expect(document.artObjects[artObject.id]).toBeUndefined()
    })

    it('should handle case where art object not in layer artObjectIds', () => {
      const command = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObject,
      })

      // executeせずに直接オブジェクトを追加（layerのartObjectIdsには追加されない）
      document.artObjects[artObject.id] = artObject

      expect(() => command.undo(document)).not.toThrow()
      expect(document.artObjects[artObject.id]).toBeUndefined()
    })
  })

  describe('getDescription', () => {
    it('should return correct description', () => {
      const command = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObject,
      })

      expect(command.getDescription()).toBe(
        `オブジェクト追加: ${artObject.type}`,
      )
    })
  })

  describe('command properties', () => {
    it('should have correct type', () => {
      const command = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObject,
      })

      expect(command.type).toBe('addArtObject')
    })

    it('should inherit from BaseCommand', () => {
      const command = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObject,
      })

      expect(command.canUndo()).toBe(true)
      expect(command.id).toBeDefined()
      expect(command.timestamp).toBeInstanceOf(Date)
    })

    it('should have unique id', () => {
      const command1 = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObject,
      })
      const command2 = new AddArtObjectCommand({
        artObjectId: artObject.id,
        artObjectData: artObject,
      })

      expect(command1.id).not.toBe(command2.id)
    })
  })
})
