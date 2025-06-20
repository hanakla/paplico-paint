import { Vector2 } from '../../state'
import {
  ArtObject,
  isPathArtObject,
  isCanvasArtObject,
  isGroupArtObject,
} from '../../document/art-object'
import { Document } from '../../document/document'
import { Camera2D } from '../../camera/camera-2d'
import { HitTestResult } from './types'

import { PathHitTester } from './path-hit-tester'
import { CanvasHitTester } from './canvas-hit-tester'
import { GroupHitTester } from './group-hit-tester'

/**
 * レイキャスト・ヒットテスト機能
 */
export class HitTester {
  /**
   * スクリーン座標からオブジェクトへのヒットテストを実行
   */
  static hitTest(
    screenX: number,
    screenY: number,
    document: Document,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
  ): HitTestResult[] {
    // スクリーン座標をワールド座標に変換
    const worldPos = camera.screenToWorld(
      screenX,
      screenY,
      canvasSize.width,
      canvasSize.height,
    )

    const results: HitTestResult[] = []

    // レイヤーを前面から順にテスト（描画順の逆順）
    const sortedLayerNodes = document.layerNodes
      .filter((node) => node.parentId === null)
      .sort((a, b) => b.order - a.order) // 前面から背面へ

    for (const layerNode of sortedLayerNodes) {
      const layer = document.layers[layerNode.layerId]
      if (!layer || !layer.visible) {
        continue
      }

      // ベクターレイヤーのアートオブジェクトをテスト
      if (layer.type === 'vector' && layer.artObjectIds) {
        // アートオブジェクトを前面から順にテスト
        const sortedArtObjects = [...layer.artObjectIds].reverse()

        for (const artObjectId of sortedArtObjects) {
          const artObject = document.artObjects[artObjectId]
          if (!artObject || !artObject.visible) {
            continue
          }

          const hitResult = this.testArtObject(artObject, worldPos, layer.id)
          if (hitResult) {
            results.push(hitResult)
          } else {
          }
        }
      }
    }

    return results
  }

  /**
   * 単一のアートオブジェクトに対するヒットテスト
   */
  private static testArtObject(
    artObject: ArtObject,
    worldPos: Vector2,
    layerId: string,
  ): HitTestResult | null {
    if (isPathArtObject(artObject)) {
      return PathHitTester.test(artObject, worldPos, layerId)
    } else if (isCanvasArtObject(artObject)) {
      return CanvasHitTester.test(artObject, worldPos, layerId)
    } else if (isGroupArtObject(artObject)) {
      return GroupHitTester.test(artObject, worldPos, layerId)
    }

    return null
  }

  /**
   * 最も近いオブジェクトを取得（距離順）
   */
  static getClosestHit(hits: HitTestResult[]): HitTestResult | null {
    if (hits.length === 0) return null

    return hits.reduce((closest, current) =>
      current.distance < closest.distance ? current : closest,
    )
  }

  /**
   * 特定のレイヤーのヒットのみを取得
   */
  static getHitsInLayer(
    hits: HitTestResult[],
    layerId: string,
  ): HitTestResult[] {
    return hits.filter((hit) => hit.layerId === layerId)
  }
}
