import type { ArtObject } from '../../document/art-object'
import type { Vector2 } from '../../state'

/**
 * ヒットテスト結果
 */
export interface HitTestResult {
  /** ヒットしたオブジェクト */
  artObject: ArtObject
  /** ヒット位置（ワールド座標） */
  worldPosition: Vector2
  /** ヒット位置（ローカル座標） */
  localPosition: Vector2
  /** ヒット距離（0.0 = 完全一致、1.0 = 境界） */
  distance: number
  /** レイヤーID */
  layerId: string
}
