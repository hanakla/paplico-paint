import { Vector2 } from '../../state'
import { ArtObject } from '../../document/art-object'
import { HitTestResult } from './types'

/**
 * GroupArtObjectのヒットテスト処理
 */
export class GroupHitTester {
  /**
   * GroupArtObjectのヒットテスト
   */
  static test(
    groupObject: ArtObject & { type: 'group' },
    worldPos: Vector2,
    layerId: string,
  ): HitTestResult | null {
    // グループの場合は簡単な境界ボックステストを実装
    // 実際の実装では子オブジェクトを再帰的にテストする必要がある

    // TODO: 子オブジェクトの境界ボックスを計算してヒットテストを実装
    return null
  }
}
