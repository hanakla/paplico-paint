/**
 * DeleteArtObjectsCommandのテスト
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createPathArtObject } from '../document/art-object';
import type { Document } from '../document/document';
import { createVectorLayer } from '../document/layer';
import { generateUid } from '../document/utils';
import { DocumentManager } from '../document-manager';
import { createVectorPath } from '../state';
import { DeleteArtObjectsCommand } from './DeleteArtObjectsCommand';

describe('DeleteArtObjectsCommand', () => {
  let documentManager: DocumentManager;
  let document: Document;
  let artObjectId1: string;
  let artObjectId2: string;
  let layerId: string;

  beforeEach(() => {
    documentManager = new DocumentManager();

    // テスト用ドキュメントを作成
    const vectorLayer = createVectorLayer({
      name: 'Test Layer',
    });
    layerId = vectorLayer.id;

    const path1 = createVectorPath([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 200 },
    ]);

    const path2 = createVectorPath([
      { x: 300, y: 300 },
      { x: 400, y: 300 },
      { x: 400, y: 400 },
    ]);

    const artObject1 = createPathArtObject({
      layerId: vectorLayer.id,
      path: path1,
      appearances: [],
    });

    const artObject2 = createPathArtObject({
      layerId: vectorLayer.id,
      path: path2,
      appearances: [],
    });

    artObjectId1 = artObject1.id;
    artObjectId2 = artObject2.id;

    // レイヤーにオブジェクトを追加
    vectorLayer.artObjectIds = [artObjectId1, artObjectId2];

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
    };

    // DocumentManagerにドキュメントを追加
    documentManager.loadDocument(document);
    documentManager.setActiveDocument(document.id);
  });

  describe('execute', () => {
    it('should delete single art object from document', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      expect(document.artObjects[artObjectId1]).toBeDefined();
      expect(document.layers[layerId].artObjectIds).toContain(artObjectId1);

      command.execute(document);

      expect(document.artObjects[artObjectId1]).toBeUndefined();
      expect(document.layers[layerId].artObjectIds).not.toContain(artObjectId1);
    });

    it('should delete multiple art objects from document', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1, artObjectId2] },
        documentManager,
      );

      expect(document.artObjects[artObjectId1]).toBeDefined();
      expect(document.artObjects[artObjectId2]).toBeDefined();
      expect(document.layers[layerId].artObjectIds).toEqual([
        artObjectId1,
        artObjectId2,
      ]);

      command.execute(document);

      expect(document.artObjects[artObjectId1]).toBeUndefined();
      expect(document.artObjects[artObjectId2]).toBeUndefined();
      expect(document.layers[layerId].artObjectIds).toEqual([]);
    });

    it('should update document updatedAt timestamp', async () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      const originalTimestamp = document.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 1));
      command.execute(document);
      expect(document.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalTimestamp.getTime(),
      );
    });

    it('should handle non-existent art objects gracefully', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: ['non-existent-id'] },
        documentManager,
      );

      expect(() => command.execute(document)).not.toThrow();
    });

    it('should throw error when no document provided', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      expect(() => command.execute(null as any)).toThrow(
        'ドキュメントが指定されていません',
      );
    });

    it('should save deleted objects for undo', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      const originalObject = { ...document.artObjects[artObjectId1] };

      command.execute(document);

      // @ts-ignore - accessing private property for testing
      expect(command.deletedObjects.get(artObjectId1)).toEqual(originalObject);
      // @ts-ignore - accessing private property for testing
      expect(command.deletedObjectLayerIds.get(artObjectId1)).toBe(layerId);
    });
  });

  describe('undo', () => {
    it('should restore deleted art object', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      const originalObject = { ...document.artObjects[artObjectId1] };

      // 削除実行
      command.execute(document);
      expect(document.artObjects[artObjectId1]).toBeUndefined();
      expect(document.layers[layerId].artObjectIds).not.toContain(artObjectId1);

      // undo実行
      command.undo(document);
      expect(document.artObjects[artObjectId1]).toEqual(originalObject);
      expect(document.layers[layerId].artObjectIds).toContain(artObjectId1);
    });

    it('should restore multiple deleted art objects', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1, artObjectId2] },
        documentManager,
      );

      const originalObject1 = { ...document.artObjects[artObjectId1] };
      const originalObject2 = { ...document.artObjects[artObjectId2] };

      // 削除実行
      command.execute(document);
      expect(document.artObjects[artObjectId1]).toBeUndefined();
      expect(document.artObjects[artObjectId2]).toBeUndefined();

      // undo実行
      command.undo(document);
      expect(document.artObjects[artObjectId1]).toEqual(originalObject1);
      expect(document.artObjects[artObjectId2]).toEqual(originalObject2);
      expect(document.layers[layerId].artObjectIds).toContain(artObjectId1);
      expect(document.layers[layerId].artObjectIds).toContain(artObjectId2);
    });

    it('should throw error when no document provided', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      command.execute(document);
      expect(() => command.undo(null as any)).toThrow(
        'ドキュメントが指定されていません',
      );
    });

    it('should update document updatedAt timestamp', async () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      command.execute(document);
      const originalTimestamp = document.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 1));
      command.undo(document);
      expect(document.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalTimestamp.getTime(),
      );
    });
  });

  describe('redo', () => {
    it('should delete objects again after undo', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      // 削除実行
      command.execute(document);
      expect(document.artObjects[artObjectId1]).toBeUndefined();

      // undo実行
      command.undo(document);
      expect(document.artObjects[artObjectId1]).toBeDefined();

      // redo実行
      command.redo(document);
      expect(document.artObjects[artObjectId1]).toBeUndefined();
      expect(document.layers[layerId].artObjectIds).not.toContain(artObjectId1);
    });
  });

  describe('canUndo', () => {
    it('should always return true', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      expect(command.canUndo()).toBe(true);
    });
  });

  describe('canRedo', () => {
    it('should always return true', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      expect(command.canRedo()).toBe(true);
    });
  });

  describe('getDescription', () => {
    it('should return correct description for single object', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      expect(command.getDescription()).toBe('オブジェクトを削除');
    });

    it('should return correct description for multiple objects', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1, artObjectId2] },
        documentManager,
      );

      expect(command.getDescription()).toBe('2個のオブジェクトを削除');
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize correctly', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      // 削除実行してデータを保存
      command.execute(document);

      // シリアライズ
      const serialized = command.serialize();
      expect(serialized.type).toBe('DeleteArtObjectsCommand');
      expect(serialized.id).toBe(command.id);
      expect(serialized.params).toEqual({ artObjectIds: [artObjectId1] });

      // デシリアライズ
      const deserializedCommand = DeleteArtObjectsCommand.deserialize(
        serialized,
        documentManager,
      );
      expect(deserializedCommand.type).toBe(command.type);
      expect(deserializedCommand.getDescription()).toBe(
        command.getDescription(),
      );
      // Note: IDは新しく生成されるため、元のIDとは異なる
    });
  });

  describe('command properties', () => {
    it('should have correct type', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      expect(command.type).toBe('delete-art-objects');
    });

    it('should have unique id', () => {
      const command1 = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );
      const command2 = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      expect(command1.id).not.toBe(command2.id);
    });

    it('should have timestamp', () => {
      const command = new DeleteArtObjectsCommand(
        { artObjectIds: [artObjectId1] },
        documentManager,
      );

      expect(command.timestamp).toBeInstanceOf(Date);
    });
  });
});
