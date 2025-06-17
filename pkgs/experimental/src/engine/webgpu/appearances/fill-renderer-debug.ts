import { triangulatePolygon } from './fill-renderer'
import type { VectorPath } from '../../document/path'
import { createSolidFill } from '../../document/appearance'

/**
 * FillRendererのデバッグ用ユーティリティ
 * 三角分割の結果を詳細に分析
 */

export function debugTriangulation() {
  // テストケース1: 単純な四角形
  const simpleRect: VectorPath = {
    points: [
      { x: 100, y: 100, pressure: 1 },
      { x: 200, y: 100, pressure: 1 },
      { x: 200, y: 200, pressure: 1 },
      { x: 100, y: 200, pressure: 1 },
      { x: 100, y: 100, pressure: 1 }, // 閉じたパス
    ],
    closed: true,
  }

  const appearance = createSolidFill({
    color: { r: 1, g: 0, b: 0, a: 1 },
    opacity: 1,
  })

  testTriangulation('Simple Rectangle', simpleRect, appearance)

  // テストケース2: L字型（凹ポリゴン）
  const lShape: VectorPath = {
    points: [
      { x: 0, y: 0, pressure: 1 },
      { x: 50, y: 0, pressure: 1 },
      { x: 50, y: 50, pressure: 1 },
      { x: 100, y: 50, pressure: 1 },
      { x: 100, y: 100, pressure: 1 },
      { x: 0, y: 100, pressure: 1 },
      { x: 0, y: 0, pressure: 1 }, // 閉じたパス
    ],
    closed: true,
  }

  testTriangulation('L-Shape (Concave)', lShape, appearance)
}

async function testTriangulation(
  name: string,
  path: VectorPath,
  appearance: any,
) {
  try {
    const triangles = await triangulatePolygon(path, appearance)

    // 三角形ごとに詳細を表示
    const triangleCount = triangles.length / 18
    for (let i = 0; i < triangleCount; i++) {
      const startIdx = i * 18
      const v1 = { x: triangles[startIdx], y: triangles[startIdx + 1] }
      const v2 = { x: triangles[startIdx + 6], y: triangles[startIdx + 7] }
      const v3 = { x: triangles[startIdx + 12], y: triangles[startIdx + 13] }

      // 三角形の面積を計算（向きの確認）
      const area = (v2.x - v1.x) * (v3.y - v1.y) - (v3.x - v1.x) * (v2.y - v1.y)
    }

    // バウンディングボックスの確認
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    for (let i = 0; i < triangles.length; i += 6) {
      const x = triangles[i]
      const y = triangles[i + 1]
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  } catch (error) {}
}

export function testCoordinateTransformation() {
  // 単純な正方形のバウンディングボックス
  const bounds = { x: 100, y: 100, width: 100, height: 100 }

  // オフスクリーン投影行列の計算
  const left = bounds.x
  const right = bounds.x + bounds.width
  const top = bounds.y + bounds.height // 200
  const bottom = bounds.y // 100

  // 正射影行列
  const projMatrix = [
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

  // テスト座標
  const testPoints = [
    { x: 100, y: 100, name: 'top-left' },
    { x: 200, y: 100, name: 'top-right' },
    { x: 150, y: 150, name: 'center' },
    { x: 100, y: 200, name: 'bottom-left' },
    { x: 200, y: 200, name: 'bottom-right' },
  ]

  for (const point of testPoints) {
    // 投影変換
    const ndcX = (2 * (point.x - left)) / (right - left) - 1
    const ndcY = (2 * (point.y - bottom)) / (top - bottom) - 1
  }
}
