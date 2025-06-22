import type { ArtObject } from '../../document/art-object'
import type { Vector2 } from '../../state'
import type { HitTestResult } from './types'

/**
 * GroupArtObjectのヒットテスト処理
 */
export class GroupHitTester {
  /**
   * GroupArtObjectのヒットテスト
   */
  static test(
    _groupObject: ArtObject & { type: 'group' },
    _worldPos: Vector2,
    _layerId: string,
  ): HitTestResult | null {
    // グループの場合は簡単な境界ボックステストを実装
    // 実際の実装では子オブジェクトを再帰的にテストする必要がある

    // TODO: 子オブジェクトの境界ボックスを計算してヒットテストを実装
    return null
  }
}
