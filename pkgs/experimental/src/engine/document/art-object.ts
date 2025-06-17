import { UUID, Transform } from './types'
import { VectorPath } from './path'
import { Appearance } from './appearance'

/**
 * 基本ArtObjectインターフェース
 */
export interface BaseArtObject {
  id: UUID
  name: string
  /** 所属レイヤーのID */
  layerId: UUID
  /** 配置されるアートボードのID（nullの場合は全アートボードに表示） */
  artboardId: UUID | null
  /** オブジェクトの変形情報 */
  transform: Transform
  /** アピアランスの配列（描画順序） */
  appearances: Appearance[]
  /** 表示・非表示 */
  visible: boolean
  /** ロック状態 */
  locked: boolean
  /** 選択状態（編集用） */
  selected?: boolean
}

/**
 * パスArtObject：パス情報を持つ描画オブジェクト
 */
export interface PathArtObject extends BaseArtObject {
  type: 'path'
  /** パス情報 */
  path: VectorPath
}

/**
 * グループArtObject：他のArtObjectをグループ化するオブジェクト
 */
export interface GroupArtObject extends BaseArtObject {
  type: 'group'
  /** 子ArtObjectのID配列（描画順序） */
  childArtObjectIds: UUID[]
  /** グループの展開状態（UI用） */
  expanded?: boolean
}

/**
 * すべてのArtObjectタイプの統合型
 */
export type ArtObject = PathArtObject | GroupArtObject

/**
 * パスArtObject作成用パラメータ
 */
export interface CreatePathArtObjectParams {
  name?: string
  layerId: UUID
  artboardId?: UUID | null
  x?: number
  y?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  path?: VectorPath
  appearances?: Appearance[]
  visible?: boolean
  locked?: boolean
}

/**
 * グループArtObject作成用パラメータ
 */
export interface CreateGroupArtObjectParams {
  name?: string
  layerId: UUID
  artboardId?: UUID | null
  x?: number
  y?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
  appearances?: Appearance[]
  visible?: boolean
  locked?: boolean
  expanded?: boolean
}

/**
 * パスArtObject作成ファクトリー関数
 */
export function createPathArtObject(
  params: CreatePathArtObjectParams,
): PathArtObject {
  return {
    id: crypto.randomUUID(),
    type: 'path',
    name: params.name || 'Path Object',
    layerId: params.layerId,
    artboardId: params.artboardId || null,
    transform: {
      x: params.x || 0,
      y: params.y || 0,
      rotation: params.rotation || 0,
      scaleX: params.scaleX || 1,
      scaleY: params.scaleY || 1,
    },
    path: params.path || { points: [], closed: false },
    appearances: params.appearances || [],
    visible: params.visible !== false,
    locked: params.locked || false,
    selected: false,
  }
}

/**
 * グループArtObject作成ファクトリー関数
 */
export function createGroupArtObject(
  params: CreateGroupArtObjectParams,
): GroupArtObject {
  return {
    id: crypto.randomUUID(),
    type: 'group',
    name: params.name || 'Group Object',
    layerId: params.layerId,
    artboardId: params.artboardId || null,
    transform: {
      x: params.x || 0,
      y: params.y || 0,
      rotation: params.rotation || 0,
      scaleX: params.scaleX || 1,
      scaleY: params.scaleY || 1,
    },
    appearances: params.appearances || [],
    childArtObjectIds: [],
    visible: params.visible !== false,
    locked: params.locked || false,
    expanded: params.expanded !== false,
    selected: false,
  }
}

/**
 * 後方互換性のためのレガシー関数
 * @deprecated createPathArtObjectを使用してください
 */
export function createArtObject(
  params: CreatePathArtObjectParams,
): PathArtObject {
  return createPathArtObject(params)
}

/**
 * ArtObjectにアピアランスを追加
 */
export function addAppearanceToArtObject(
  artObject: ArtObject,
  appearance: Appearance,
): void {
  artObject.appearances.push(appearance)
}

/**
 * ArtObjectからアピアランスを削除
 */
export function removeAppearanceFromArtObject(
  artObject: ArtObject,
  index: number,
): boolean {
  if (index >= 0 && index < artObject.appearances.length) {
    artObject.appearances.splice(index, 1)
    return true
  }
  return false
}

/**
 * ArtObjectのアピアランスを並び替え
 */
export function reorderAppearanceInArtObject(
  artObject: ArtObject,
  fromIndex: number,
  toIndex: number,
): boolean {
  if (
    fromIndex >= 0 &&
    fromIndex < artObject.appearances.length &&
    toIndex >= 0 &&
    toIndex < artObject.appearances.length
  ) {
    const appearance = artObject.appearances.splice(fromIndex, 1)[0]
    artObject.appearances.splice(toIndex, 0, appearance)
    return true
  }
  return false
}

/**
 * ArtObjectの変形を適用
 */
export function transformArtObject(
  artObject: ArtObject,
  transform: Partial<Transform>,
): void {
  Object.assign(artObject.transform, transform)
}

/**
 * ArtObjectを別のレイヤーに移動
 */
export function moveArtObjectToLayer(
  artObject: ArtObject,
  layerId: UUID,
): void {
  artObject.layerId = layerId
}

/**
 * ArtObjectを別のアートボードに移動
 */
export function moveArtObjectToArtboard(
  artObject: ArtObject,
  artboardId: UUID | null,
): void {
  artObject.artboardId = artboardId
}

/**
 * グループArtObjectに子オブジェクトを追加
 */
export function addChildToGroupArtObject(
  groupObject: GroupArtObject,
  childId: UUID,
): void {
  if (!groupObject.childArtObjectIds.includes(childId)) {
    groupObject.childArtObjectIds.push(childId)
  }
}

/**
 * グループArtObjectから子オブジェクトを削除
 */
export function removeChildFromGroupArtObject(
  groupObject: GroupArtObject,
  childId: UUID,
): boolean {
  const index = groupObject.childArtObjectIds.indexOf(childId)
  if (index !== -1) {
    groupObject.childArtObjectIds.splice(index, 1)
    return true
  }
  return false
}

/**
 * ArtObjectの境界ボックスを計算（変形適用後）
 */
export function getArtObjectBounds(artObject: ArtObject): {
  x: number
  y: number
  width: number
  height: number
} {
  const { transform } = artObject

  if (artObject.type === 'path') {
    // パスの境界ボックスを取得
    if (artObject.path.points.length === 0) {
      return { x: transform.x, y: transform.y, width: 0, height: 0 }
    }

    let minX = artObject.path.points[0].x
    let minY = artObject.path.points[0].y
    let maxX = artObject.path.points[0].x
    let maxY = artObject.path.points[0].y

    for (const point of artObject.path.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }

    // 変形を適用
    const width = (maxX - minX) * (transform.scaleX || 1)
    const height = (maxY - minY) * (transform.scaleY || 1)

    return {
      x: transform.x + minX * (transform.scaleX || 1),
      y: transform.y + minY * (transform.scaleY || 1),
      width,
      height,
    }
  } else if (artObject.type === 'group') {
    // グループの場合は子オブジェクトの境界を計算する必要があります
    // 簡易実装として変形情報のみを返します
    return {
      x: transform.x,
      y: transform.y,
      width: 100, // デフォルトサイズ
      height: 100, // デフォルトサイズ
    }
  }

  return { x: transform.x, y: transform.y, width: 0, height: 0 }
}

/**
 * 点がArtObject内にあるかどうかを判定
 */
export function isPointInArtObject(
  artObject: ArtObject,
  x: number,
  y: number,
): boolean {
  const bounds = getArtObjectBounds(artObject)
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  )
}

/**
 * ArtObjectがPathArtObjectかどうかを判定
 */
export function isPathArtObject(
  artObject: ArtObject,
): artObject is PathArtObject {
  return artObject.type === 'path'
}

/**
 * ArtObjectがGroupArtObjectかどうかを判定
 */
export function isGroupArtObject(
  artObject: ArtObject,
): artObject is GroupArtObject {
  return artObject.type === 'group'
}
