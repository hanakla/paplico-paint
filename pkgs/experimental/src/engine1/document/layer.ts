import type { Appearance } from './appearance';
import type { BlendMode, UUID } from './types';

/**
 * レイヤーの基本インターフェース
 */
export interface BaseLayer {
  id: UUID;
  name: string;
  /** 不透明度（0-1） */
  opacity: number;
  /** 表示・非表示 */
  visible: boolean;
  /** ロック状態 */
  locked: boolean;
  /** ブレンドモード */
  blendMode: BlendMode;
  /** レイヤーアピアランスの配列（描画順序） */
  appearances: Appearance[];
}

/**
 * ベクターレイヤー
 * ArtObjectのコンテナとして機能
 */
export interface VectorLayer extends BaseLayer {
  type: 'vector';
  /** このレイヤーに属するArtObjectのID一覧 */
  artObjectIds: UUID[];
}

/**
 * グループレイヤー
 * 他のレイヤーをグループ化するコンテナ
 */
export interface GroupLayer extends BaseLayer {
  type: 'group';
  /** 子レイヤーのID一覧（描画順序） */
  childLayerIds: UUID[];
  /** グループの展開状態（UI用） */
  expanded?: boolean;
}

/**
 * ラスターレイヤー
 * ビットマップ画像を保持
 */
export interface RasterLayer extends BaseLayer {
  type: 'raster';
  /** 画像データまたはCanvas要素への参照 */
  imageData?: ImageData | HTMLCanvasElement | null;
  width: number;
  height: number;
}

/**
 * すべてのレイヤータイプの統合型
 */
export type Layer = VectorLayer | GroupLayer | RasterLayer;

/**
 * レイヤー階層構造
 * ツリー構造でレイヤーの親子関係を表現
 */
export interface LayerNode {
  layerId: UUID;
  parentId: UUID | null;
  /** 兄弟レイヤー間での順序（描画順序） */
  order: number;
}

/**
 * ベクターレイヤー作成用パラメータ
 */
export interface CreateVectorLayerParams {
  name?: string;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  blendMode?: BlendMode;
  appearances?: Appearance[];
}

/**
 * グループレイヤー作成用パラメータ
 */
export interface CreateGroupLayerParams {
  name?: string;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  blendMode?: BlendMode;
  appearances?: Appearance[];
  expanded?: boolean;
}

/**
 * ラスターレイヤー作成用パラメータ
 */
export interface CreateRasterLayerParams {
  name?: string;
  width: number;
  height: number;
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  blendMode?: BlendMode;
  appearances?: Appearance[];
}

/**
 * ベクターレイヤー作成ファクトリー関数
 */
export function createVectorLayer(
  params: CreateVectorLayerParams = {},
): VectorLayer {
  return {
    id: crypto.randomUUID(),
    type: 'vector',
    name: params.name || 'Vector Layer',
    opacity: params.opacity ?? 1,
    visible: params.visible !== false,
    locked: params.locked || false,
    blendMode: params.blendMode || 'normal',
    appearances: params.appearances || [],
    artObjectIds: [],
  };
}

/**
 * グループレイヤー作成ファクトリー関数
 */
export function createGroupLayer(
  params: CreateGroupLayerParams = {},
): GroupLayer {
  return {
    id: crypto.randomUUID(),
    type: 'group',
    name: params.name || 'Group',
    opacity: params.opacity ?? 1,
    visible: params.visible !== false,
    locked: params.locked || false,
    blendMode: params.blendMode || 'normal',
    appearances: params.appearances || [],
    childLayerIds: [],
    expanded: params.expanded !== false,
  };
}

/**
 * ラスターレイヤー作成ファクトリー関数
 */
export function createRasterLayer(
  params: CreateRasterLayerParams,
): RasterLayer {
  return {
    id: crypto.randomUUID(),
    type: 'raster',
    name: params.name || 'Raster Layer',
    width: params.width,
    height: params.height,
    opacity: params.opacity ?? 1,
    visible: params.visible !== false,
    locked: params.locked || false,
    blendMode: params.blendMode || 'normal',
    appearances: params.appearances || [],
    imageData: null,
  };
}

/**
 * レイヤーにアピアランスを追加
 */
export function addAppearanceToLayer(
  layer: Layer,
  appearance: Appearance,
): void {
  layer.appearances.push(appearance);
}

/**
 * レイヤーからアピアランスを削除
 */
export function removeAppearanceFromLayer(
  layer: Layer,
  index: number,
): boolean {
  if (index >= 0 && index < layer.appearances.length) {
    layer.appearances.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * レイヤーのアピアランスを並び替え
 */
export function reorderAppearanceInLayer(
  layer: Layer,
  fromIndex: number,
  toIndex: number,
): boolean {
  if (
    fromIndex >= 0 &&
    fromIndex < layer.appearances.length &&
    toIndex >= 0 &&
    toIndex < layer.appearances.length
  ) {
    const appearance = layer.appearances.splice(fromIndex, 1)[0];
    layer.appearances.splice(toIndex, 0, appearance);
    return true;
  }
  return false;
}

/**
 * レイヤーノード作成ファクトリー関数
 */
export function createLayerNode(
  layerId: UUID,
  parentId: UUID | null = null,
  order: number = 0,
): LayerNode {
  return {
    layerId,
    parentId,
    order,
  };
}
