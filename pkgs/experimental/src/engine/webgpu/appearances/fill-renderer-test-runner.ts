import {
  debugTriangulation,
  testCoordinateTransformation,
} from './fill-renderer-debug'

/**
 * FillRendererの問題を調査するためのテストスクリプト
 *
 * 使用方法:
 * 1. コンソールでこのファイルをインポート
 * 2. runDebugTests() を実行
 * 3. 結果をコンソールで確認
 */

export async function runDebugTests() {
  try {
    // 1. 三角分割のテスト
    await debugTriangulation()

    // 2. 座標変換のテスト
    testCoordinateTransformation()

    // 3. メインキャンバス vs オフスクリーンの違いを確認
    testCanvasVsOffscreen()
  } catch (error) {}
}

function testCanvasVsOffscreen() {
  const canvasSize = { width: 800, height: 600 }
  const layerBounds = { x: 100, y: 100, width: 100, height: 100 }

  // メインキャンバス用の投影行列（Camera2Dから）
  const mainProjMatrix = [
    2 / canvasSize.width,
    0,
    0,
    0,
    0,
    -2 / canvasSize.height,
    0,
    0,
    0,
    0,
    1,
    0,
    -1,
    1,
    0,
    1,
  ]

  // オフスクリーン用の投影行列
  const left = layerBounds.x
  const right = layerBounds.x + layerBounds.width
  const top = layerBounds.y + layerBounds.height
  const bottom = layerBounds.y

  const offscreenProjMatrix = [
    2 / (right - left),
    0,
    0,
    0,
    0,
    2 / (top - bottom),
    0,
    0,
    0,
    0,
    1,
    0,
    -(right + left) / (right - left),
    -(top + bottom) / (top - bottom),
    0,
    1,
  ]

  // 同じ点を両方の行列で変換
  const testPoint = { x: 150, y: 150 } // layerBoundsの中心

  // メインキャンバス変換
  const mainX = mainProjMatrix[0] * testPoint.x + mainProjMatrix[12]
  const mainY = mainProjMatrix[5] * testPoint.y + mainProjMatrix[13]

  // オフスクリーン変換
  const offX = offscreenProjMatrix[0] * testPoint.x + offscreenProjMatrix[12]
  const offY = offscreenProjMatrix[5] * testPoint.y + offscreenProjMatrix[13]
}

// 自動実行用
if (typeof window !== 'undefined') {
  ;(window as any).runFillRendererDebug = runDebugTests
}
