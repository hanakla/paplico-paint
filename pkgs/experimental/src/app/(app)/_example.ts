import { createVectorPath, type VectorPoint } from '../../engine/document';
import {
  createSolidFill,
  createStrokeAppearance,
} from '../../engine/document/appearance';
import { createPathArtObject } from '../../engine/document/art-object';
import { createArtboard } from '../../engine/document/artboard';
import { createDocument, type Document } from '../../engine/document/document';
import { createVectorLayer } from '../../engine/document/layer';
import type { RGBAColor } from '../../engine/document/types';

export function createTestDocument(): Document {
  const colors = {
    red: { r: 1, g: 0.2, b: 0.2, a: 1 } as RGBAColor,
    blue: { r: 0.2, g: 0.4, b: 1, a: 1 } as RGBAColor,
    green: { r: 0.2, g: 0.8, b: 0.2, a: 1 } as RGBAColor,
    purple: { r: 0.6, g: 0.2, b: 0.8, a: 1 } as RGBAColor,
    orange: { r: 1, g: 0.6, b: 0.1, a: 1 } as RGBAColor,
    black: { r: 0, g: 0, b: 0, a: 1 } as RGBAColor,
    white: { r: 1, g: 1, b: 1, a: 1 } as RGBAColor,
    gray: { r: 0.5, g: 0.5, b: 0.5, a: 0.3 } as RGBAColor,
  };

  const document = createDocument({
    name: 'テストドキュメント',
    initialArtboard: {
      name: 'メインキャンバス',
      width: 800,
      height: 600,
      backgroundColor: { r: 0.95, g: 0.95, b: 0.95, a: 1 },
    },
  });

  const mainArtboard = document.artboards[0];

  document.artboards.push(
    createArtboard({
      name: 'サブキャンバス',
      width: 400,
      height: 300,
      backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
      x: -420,
      y: 0,
      locked: false,
      visible: true,
    }),
  );

  // レイヤー1
  const shapesLayer = createVectorLayer({
    name: '基本図形',
    appearances: [
      createSolidFill({ color: colors.blue, opacity: 0.8 }),
      // createStrokeAppearance({
      //   width: 3,
      //   color: colors.black,
      //   style: 'solid',
      //   lineCap: 'round',
      //   lineJoin: 'round',
      //   opacity: 0.9,
      //   blendMode: 'normal',
      // }),
    ],
  });
  document.layers[shapesLayer.id] = shapesLayer;

  // 円形（シンプルなテスト用）
  const circlePath = createVectorPath({
    points: [
      { x: 100, y: 100, pressure: 1 },
      { x: 200, y: 100, pressure: 1 },
      { x: 200, y: 200, pressure: 1 },
      { x: 100, y: 200, pressure: 1 },
      { x: 100, y: 100, pressure: 1 },
    ] as VectorPoint[],
    closed: true,
  });
  const circleObject = createPathArtObject({
    name: 'Circle',
    layerId: shapesLayer.id,
    artboardId: mainArtboard.id,
    path: circlePath,
    appearances: [createSolidFill({ color: colors.red, opacity: 1.0 })],
  });
  document.artObjects[circleObject.id] = circleObject;
  shapesLayer.artObjectIds.push(circleObject.id);

  // 四角形（大きなテスト用）
  const rectPath = createVectorPath({
    points: [
      { x: 50, y: 50, pressure: 1 },
      { x: 750, y: 50, pressure: 1 },
      { x: 750, y: 550, pressure: 1 },
      { x: 50, y: 550, pressure: 1 },
      { x: 50, y: 50, pressure: 1 },
    ] as VectorPoint[],
    closed: true,
  });
  const rectObject = createPathArtObject({
    name: 'Rect',
    layerId: shapesLayer.id,
    artboardId: mainArtboard.id,
    path: rectPath,
    appearances: [createSolidFill({ color: colors.green, opacity: 1.0 })],
  });
  document.artObjects[rectObject.id] = rectObject;
  shapesLayer.artObjectIds.push(rectObject.id);

  const rectObject2 = createPathArtObject({
    name: 'Rect',
    layerId: shapesLayer.id,
    artboardId: mainArtboard.id,
    path: {
      ...rectPath,
      points: rectPath.points.map((p) => ({
        ...p,
        x: p.x + 100,
        y: p.y + 10,
      })),
    },
    appearances: [createSolidFill({ color: colors.orange, opacity: 1.0 })],
  });
  document.artObjects[rectObject2.id] = rectObject2;
  shapesLayer.artObjectIds.push(rectObject2.id);

  // レイヤー2
  const drawingLayer = createVectorLayer({
    name: '自由描画',
    appearances: [
      // createStrokeAppearance({
      //   width: 4,
      //   color: colors.purple,
      //   style: 'solid',
      //   lineCap: 'round',
      //   lineJoin: 'round',
      //   opacity: 0.9,
      //   blendMode: 'normal',
      // }),
    ],
  });
  document.layers[drawingLayer.id] = drawingLayer;

  // 波線
  const wavePath = createVectorPath({
    points: [
      { x: 50, y: 250, pressure: 0.8 },
      { x: 100, y: 230, pressure: 1.0 },
      { x: 150, y: 270, pressure: 0.9 },
      { x: 200, y: 240, pressure: 1.1 },
      { x: 250, y: 280, pressure: 0.7 },
      { x: 300, y: 250, pressure: 1.0 },
    ] as VectorPoint[],
    closed: false,
  });
  const waveObject = createPathArtObject({
    name: 'Wave',
    layerId: drawingLayer.id,
    artboardId: mainArtboard.id,
    path: wavePath,
    appearances: [
      createStrokeAppearance({
        width: 6,
        color: colors.orange,
        style: 'solid',
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 0.8,
        blendMode: 'normal',
      }),
    ],
  });
  document.artObjects[waveObject.id] = waveObject;
  drawingLayer.artObjectIds.push(waveObject.id);

  // レイヤー3
  const decorationLayer = createVectorLayer({
    name: '装飾',
    opacity: 0.6,
    appearances: [
      // createStrokeAppearance({
      //   width: 2,
      //   color: colors.gray,
      //   style: 'dashed',
      //   dashPattern: [5, 3],
      //   lineCap: 'round',
      //   lineJoin: 'round',
      //   opacity: 0.8,
      //   blendMode: 'normal',
      // }),
    ],
  });
  document.layers[decorationLayer.id] = decorationLayer;

  // 点線の枠
  const framePath = createVectorPath({
    points: [
      { x: 30, y: 30, pressure: 1 },
      { x: 770, y: 30, pressure: 1 },
      { x: 770, y: 570, pressure: 1 },
      { x: 30, y: 570, pressure: 1 },
      { x: 30, y: 30, pressure: 1 },
    ] as VectorPoint[],
    closed: true,
  });
  const frameObject = createPathArtObject({
    name: 'Frame',
    layerId: decorationLayer.id,
    artboardId: mainArtboard.id,
    path: framePath,
    appearances: [
      // createStrokeAppearance({
      //   width: 1,
      //   color: colors.black,
      //   style: 'dashed',
      //   dashPattern: [10, 5],
      //   lineCap: 'round',
      //   lineJoin: 'round',
      //   opacity: 0.3,
      //   blendMode: 'normal',
      // }),
    ],
  });
  document.artObjects[frameObject.id] = frameObject;
  decorationLayer.artObjectIds.push(frameObject.id);

  // レイヤーノード
  document.layerNodes = [
    { layerId: shapesLayer.id, parentId: null, order: 0 },
    { layerId: drawingLayer.id, parentId: null, order: 1 },
    { layerId: decorationLayer.id, parentId: null, order: 2 },
  ];

  // アクティブレイヤーを設定（描画用レイヤーを選択）
  document.activeLayerId = drawingLayer.id;

  return document;
}

/**
 * シンプルなテスト用ドキュメント（デバッグ用）
 */
export function createSimpleTestDocument(): Document {
  const document = createDocument({
    name: 'シンプルテスト',
    initialArtboard: {
      name: 'テストキャンバス',
      width: 400,
      height: 300,
      backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
    },
  });
  const artboard = document.artboards[0];

  const layer = createVectorLayer({ name: 'テストレイヤー' });
  document.layers[layer.id] = layer;

  // シンプルな線
  const simplePath = createVectorPath({
    points: [
      { x: 50, y: 50, pressure: 1 },
      { x: 350, y: 250, pressure: 1 },
    ],
    closed: false,
  });
  const simpleObject = createPathArtObject({
    name: 'SimpleLine',
    layerId: layer.id,
    artboardId: artboard.id,
    path: simplePath,
    appearances: [
      createStrokeAppearance({
        width: 5,
        color: { r: 1, g: 0, b: 0, a: 1 },
        style: 'solid',
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 1,
        blendMode: 'normal',
      }),
    ],
  });
  document.artObjects[simpleObject.id] = simpleObject;
  layer.artObjectIds.push(simpleObject.id);

  document.layerNodes = [{ layerId: layer.id, parentId: null, order: 0 }];

  // アクティブレイヤーを設定
  document.activeLayerId = layer.id;

  return document;
}
