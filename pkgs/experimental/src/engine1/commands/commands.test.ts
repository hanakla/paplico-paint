/**
 * Commands統合テストスイート
 * 全てのコマンドが正しく連携動作することを確認
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createPathArtObject } from '../document/art-object';
import type { Document } from '../document/document';
import { createVectorLayer } from '../document/layer';
import { generateUid } from '../document/utils';
import { DocumentManager } from '../document-manager';
import { createVectorPath } from '../state';

import { AddArtObjectCommand } from './add-art-object-command';
import { DeleteArtObjectsCommand } from './DeleteArtObjectsCommand';
import { MoveArtObjectsCommand } from './MoveArtObjectsCommand';
import { TransformArtObjectCommand } from './TransformArtObjectCommand';

describe('Commands Integration Tests', () => {
  let documentManager: DocumentManager;
  let document: Document;
  let vectorLayer: any;
  let artObject1: any;
  let artObject2: any;

  beforeEach(() => {
    documentManager = new DocumentManager();

    // テスト用ドキュメントを作成
    vectorLayer = createVectorLayer({
      name: 'Test Layer',
    });

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

    artObject1 = createPathArtObject({
      layerId: vectorLayer.id,
      path: path1,
      appearances: [],
    });

    artObject2 = createPathArtObject({
      layerId: vectorLayer.id,
      path: path2,
      appearances: [],
    });

    // 初期transform設定
    artObject1.transform = { x: 50, y: 50, rotation: 0, scaleX: 1, scaleY: 1 };
    artObject2.transform = {
      x: 150,
      y: 150,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };

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
    };

    // DocumentManagerにドキュメントを追加
    documentManager.loadDocument(document);
    documentManager.setActiveDocument(document.id);
  });

  describe('command workflow integration', () => {
    it('should handle complete add -> move -> transform -> delete workflow', () => {
      // 1. オブジェクト追加
      const addCommand = new AddArtObjectCommand({
        artObjectId: artObject1.id,
        artObjectData: artObject1,
      });

      addCommand.execute(document);
      expect(document.artObjects[artObject1.id]).toBeDefined();
      expect(document.layers[vectorLayer.id].artObjectIds).toContain(
        artObject1.id,
      );

      // 2. オブジェクト移動
      const moveCommand = new MoveArtObjectsCommand(
        { artObjectIds: [artObject1.id], offset: { x: 25, y: -10 } },
        documentManager,
      );

      const originalX = document.artObjects[artObject1.id].transform.x;
      const originalY = document.artObjects[artObject1.id].transform.y;

      moveCommand.execute(document);
      expect(document.artObjects[artObject1.id].transform.x).toBe(
        originalX + 25,
      );
      expect(document.artObjects[artObject1.id].transform.y).toBe(
        originalY - 10,
      );

      // 3. オブジェクト変形
      const transformCommand = new TransformArtObjectCommand(
        {
          artObjectId: artObject1.id,
          newTransform: { rotation: 45, scaleX: 2 },
        },
        documentManager,
      );

      transformCommand.execute(document);
      expect(document.artObjects[artObject1.id].transform.rotation).toBe(45);
      expect(document.artObjects[artObject1.id].transform.scaleX).toBe(2);

      // 4. オブジェクト削除
      const deleteCommand = new DeleteArtObjectsCommand(
        { artObjectIds: [artObject1.id] },
        documentManager,
      );

      deleteCommand.execute(document);
      expect(document.artObjects[artObject1.id]).toBeUndefined();
      expect(document.layers[vectorLayer.id].artObjectIds).not.toContain(
        artObject1.id,
      );

      // 5. undo chain test - 削除をundo
      deleteCommand.undo(document);
      expect(document.artObjects[artObject1.id]).toBeDefined();
      expect(document.artObjects[artObject1.id].transform.rotation).toBe(45);
      expect(document.artObjects[artObject1.id].transform.scaleX).toBe(2);

      // 6. 変形をundo
      transformCommand.undo(document);
      expect(document.artObjects[artObject1.id].transform.rotation).toBe(0);
      expect(document.artObjects[artObject1.id].transform.scaleX).toBe(1);

      // 7. 移動をundo
      moveCommand.undo(document);
      expect(document.artObjects[artObject1.id].transform.x).toBe(originalX);
      expect(document.artObjects[artObject1.id].transform.y).toBe(originalY);

      // 8. 追加をundo
      addCommand.undo(document);
      expect(document.artObjects[artObject1.id]).toBeUndefined();
    });

    it('should handle multiple objects operations', () => {
      // 複数オブジェクトを追加
      const addCommand1 = new AddArtObjectCommand({
        artObjectId: artObject1.id,
        artObjectData: artObject1,
      });
      const addCommand2 = new AddArtObjectCommand({
        artObjectId: artObject2.id,
        artObjectData: artObject2,
      });

      addCommand1.execute(document);
      addCommand2.execute(document);

      expect(Object.keys(document.artObjects)).toHaveLength(2);

      // 複数オブジェクトを同時移動
      const moveCommand = new MoveArtObjectsCommand(
        {
          artObjectIds: [artObject1.id, artObject2.id],
          offset: { x: 50, y: 100 },
        },
        documentManager,
      );

      const original1X = document.artObjects[artObject1.id].transform.x;
      const original1Y = document.artObjects[artObject1.id].transform.y;
      const original2X = document.artObjects[artObject2.id].transform.x;
      const original2Y = document.artObjects[artObject2.id].transform.y;

      moveCommand.execute(document);

      expect(document.artObjects[artObject1.id].transform.x).toBe(
        original1X + 50,
      );
      expect(document.artObjects[artObject1.id].transform.y).toBe(
        original1Y + 100,
      );
      expect(document.artObjects[artObject2.id].transform.x).toBe(
        original2X + 50,
      );
      expect(document.artObjects[artObject2.id].transform.y).toBe(
        original2Y + 100,
      );

      // 複数オブジェクトを同時削除
      const deleteCommand = new DeleteArtObjectsCommand(
        { artObjectIds: [artObject1.id, artObject2.id] },
        documentManager,
      );

      deleteCommand.execute(document);
      expect(Object.keys(document.artObjects)).toHaveLength(0);
      expect(document.layers[vectorLayer.id].artObjectIds).toHaveLength(0);

      // undo chain
      deleteCommand.undo(document);
      expect(Object.keys(document.artObjects)).toHaveLength(2);

      moveCommand.undo(document);
      expect(document.artObjects[artObject1.id].transform.x).toBe(original1X);
      expect(document.artObjects[artObject1.id].transform.y).toBe(original1Y);
      expect(document.artObjects[artObject2.id].transform.x).toBe(original2X);
      expect(document.artObjects[artObject2.id].transform.y).toBe(original2Y);
    });

    it('should handle command merging for transform operations', () => {
      // オブジェクト追加
      const addCommand = new AddArtObjectCommand({
        artObjectId: artObject1.id,
        artObjectData: artObject1,
      });
      addCommand.execute(document);

      // 連続する変形コマンド
      const transformCommand1 = new TransformArtObjectCommand(
        { artObjectId: artObject1.id, newTransform: { x: 100, y: 200 } },
        documentManager,
      );

      transformCommand1.execute(document);

      const transformCommand2 = new TransformArtObjectCommand(
        { artObjectId: artObject1.id, newTransform: { x: 150, rotation: 30 } },
        documentManager,
      );

      // マージ可能かテスト
      expect(transformCommand1.canMergeWith(transformCommand2)).toBe(true);

      // マージしたコマンドを作成
      const mergedCommand = transformCommand1.mergeWith(transformCommand2);
      expect(mergedCommand).not.toBeNull();

      // マージしたコマンドをテスト
      if (mergedCommand) {
        // 元のコマンドをundo
        transformCommand1.undo(document);

        // マージしたコマンドを実行
        mergedCommand.execute(document);

        expect(document.artObjects[artObject1.id].transform.x).toBe(150);
        expect(document.artObjects[artObject1.id].transform.rotation).toBe(30);
        // マージされたコマンドはnewTransformのみを適用するため、y値は元に戻る
        expect(document.artObjects[artObject1.id].transform.y).toBe(50);

        // マージしたコマンドをundo
        mergedCommand.undo(document);

        // 最初の状態に戻っていることを確認
        expect(document.artObjects[artObject1.id].transform.x).toBe(50);
        expect(document.artObjects[artObject1.id].transform.y).toBe(50);
        expect(document.artObjects[artObject1.id].transform.rotation).toBe(0);
      }
    });

    it('should maintain document consistency across all operations', () => {
      const operations = [
        () => {
          const addCommand = new AddArtObjectCommand({
            artObjectId: artObject1.id,
            artObjectData: artObject1,
          });
          addCommand.execute(document);
          return addCommand;
        },
        () => {
          const moveCommand = new MoveArtObjectsCommand(
            { artObjectIds: [artObject1.id], offset: { x: 10, y: 20 } },
            documentManager,
          );
          moveCommand.execute(document);
          return moveCommand;
        },
        () => {
          const transformCommand = new TransformArtObjectCommand(
            { artObjectId: artObject1.id, newTransform: { scaleY: 0.5 } },
            documentManager,
          );
          transformCommand.execute(document);
          return transformCommand;
        },
      ];

      const commands: any[] = [];
      let lastTimestamp = document.updatedAt;

      // 各操作が文書の整合性を維持することを確認
      for (const operation of operations) {
        const command = operation();
        commands.push(command);

        // updatedAtが更新されていることを確認（同じ場合もある）
        expect(document.updatedAt.getTime()).toBeGreaterThanOrEqual(
          lastTimestamp.getTime(),
        );
        lastTimestamp = document.updatedAt;

        // レイヤーとartObjectsの整合性を確認
        if (document.artObjects[artObject1.id]) {
          expect(document.layers[vectorLayer.id].artObjectIds).toContain(
            artObject1.id,
          );
        } else {
          expect(document.layers[vectorLayer.id].artObjectIds).not.toContain(
            artObject1.id,
          );
        }
      }

      // 逆順でundoして整合性を維持
      for (let i = commands.length - 1; i >= 0; i--) {
        commands[i].undo(document);

        // updatedAtが更新されていることを確認（同じ場合もある）
        expect(document.updatedAt.getTime()).toBeGreaterThanOrEqual(
          lastTimestamp.getTime(),
        );
        lastTimestamp = document.updatedAt;

        // レイヤーとartObjectsの整合性を確認
        if (document.artObjects[artObject1.id]) {
          expect(document.layers[vectorLayer.id].artObjectIds).toContain(
            artObject1.id,
          );
        } else {
          expect(document.layers[vectorLayer.id].artObjectIds).not.toContain(
            artObject1.id,
          );
        }
      }

      // 最終的に初期状態に戻っていることを確認
      expect(Object.keys(document.artObjects)).toHaveLength(0);
      expect(document.layers[vectorLayer.id].artObjectIds).toHaveLength(0);
    });
  });
});
