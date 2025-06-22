import type { ArtObject } from '../../document/art-object'
import type { Vector2 } from '../../state'
import type { HitTestResult } from './types'

/**
 * CanvasArtObjectのヒットテスト処理
 */
export class CanvasHitTester {
  /**
   * CanvasArtObjectのヒットテスト
   */
  static test(
    canvasObject: ArtObject & { type: 'canvas' },
    worldPos: Vector2,
    layerId: string,
  ): HitTestResult | null {
    const transform = canvasObject.transform
    const x1 = transform.x
    const y1 = transform.y
    const x2 = transform.x + canvasObject.width * (transform.scaleX || 1)
    const y2 = transform.y + canvasObject.height * (transform.scaleY || 1)

    // 矩形内部のヒットテスト
    const isInside =
      worldPos.x >= x1 &&
      worldPos.x <= x2 &&
      worldPos.y >= y1 &&
      worldPos.y <= y2

    if (isInside) {
      const localPos = {
        x: (worldPos.x - x1) / (transform.scaleX || 1),
        y: (worldPos.y - y1) / (transform.scaleY || 1),
      }

      // 中心からの距離を計算
      const centerX = (x1 + x2) / 2
      const centerY = (y1 + y2) / 2
      const distanceFromCenter = Math.sqrt(
        (worldPos.x - centerX) ** 2 + (worldPos.y - centerY) ** 2,
      )
      const maxDistance = Math.sqrt(((x2 - x1) / 2) ** 2 + ((y2 - y1) / 2) ** 2)

      const result = {
        artObject: canvasObject,
        worldPosition: worldPos,
        localPosition: localPos,
        distance: distanceFromCenter / maxDistance,
        layerId,
      }

      return result
    }

    return null
  }
}
