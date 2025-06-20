import { Vector2 } from '../../state'
import { ArtObject } from '../../document/art-object'
import { HitTestResult } from './types'

/**
 * PathArtObjectのヒットテスト処理
 */
export class PathHitTester {
  /**
   * PathArtObjectのヒットテスト
   */
  static test(
    pathObject: ArtObject & { type: 'path' },
    worldPos: Vector2,
    layerId: string,
  ): HitTestResult | null {
    const path = pathObject.path
    if (!path?.points || path.points.length < 2) return null

    // パスの各線分に対して距離を計算
    let minDistance = Infinity
    let closestPoint: Vector2 | null = null

    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i]
      const p2 = path.points[i + 1]

      const distance = this.pointToLineDistance(worldPos, p1, p2)
      if (distance < minDistance) {
        minDistance = distance
        closestPoint = this.closestPointOnLine(worldPos, p1, p2)
      }
    }

    // 閉じたパスの場合、最後の点と最初の点も接続
    if (path.closed && path.points.length > 2) {
      const p1 = path.points[path.points.length - 1]
      const p2 = path.points[0]

      const distance = this.pointToLineDistance(worldPos, p1, p2)
      if (distance < minDistance) {
        minDistance = distance
        closestPoint = this.closestPointOnLine(worldPos, p1, p2)
      }
    }

    // ストローク幅を考慮したヒット判定
    const maxStrokeWidth = this.getMaxStrokeWidth(pathObject.appearances)
    const hitTolerance = Math.max(maxStrokeWidth / 2, 5) // 最小5ピクセルの許容範囲

    if (minDistance <= hitTolerance && closestPoint) {
      // ローカル座標を計算（現在は変形なしと仮定）
      const localPos = {
        x: worldPos.x - (pathObject.transform?.x || 0),
        y: worldPos.y - (pathObject.transform?.y || 0),
      }

      return {
        artObject: pathObject,
        worldPosition: worldPos,
        localPosition: localPos,
        distance: minDistance / hitTolerance, // 正規化された距離
        layerId,
      }
    }

    return null
  }

  /**
   * 点と線分の距離を計算
   */
  private static pointToLineDistance(
    point: Vector2,
    lineStart: Vector2,
    lineEnd: Vector2,
  ): number {
    const A = point.x - lineStart.x
    const B = point.y - lineStart.y
    const C = lineEnd.x - lineStart.x
    const D = lineEnd.y - lineStart.y

    const dot = A * C + B * D
    const lenSq = C * C + D * D

    if (lenSq === 0) {
      // 線分の長さが0の場合
      return Math.sqrt(A * A + B * B)
    }

    let param = dot / lenSq

    let xx: number, yy: number

    if (param < 0) {
      xx = lineStart.x
      yy = lineStart.y
    } else if (param > 1) {
      xx = lineEnd.x
      yy = lineEnd.y
    } else {
      xx = lineStart.x + param * C
      yy = lineStart.y + param * D
    }

    const dx = point.x - xx
    const dy = point.y - yy

    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * 線分上の最も近い点を取得
   */
  private static closestPointOnLine(
    point: Vector2,
    lineStart: Vector2,
    lineEnd: Vector2,
  ): Vector2 {
    const A = point.x - lineStart.x
    const B = point.y - lineStart.y
    const C = lineEnd.x - lineStart.x
    const D = lineEnd.y - lineStart.y

    const dot = A * C + B * D
    const lenSq = C * C + D * D

    if (lenSq === 0) {
      return { x: lineStart.x, y: lineStart.y }
    }

    let param = dot / lenSq
    param = Math.max(0, Math.min(1, param))

    return {
      x: lineStart.x + param * C,
      y: lineStart.y + param * D,
    }
  }

  /**
   * アピアランスから最大ストローク幅を取得
   */
  private static getMaxStrokeWidth(appearances: any[]): number {
    let maxWidth = 0
    for (const appearance of appearances) {
      if (appearance.effectId === 'stroke' && appearance.enabled) {
        const strokeWidth = appearance.params?.width || 0
        maxWidth = Math.max(maxWidth, strokeWidth)
      }
    }
    return maxWidth || 1 // デフォルトは1ピクセル
  }
}
