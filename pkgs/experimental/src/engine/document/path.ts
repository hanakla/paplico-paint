import type { VectorPoint } from './types'

/**
 * ベクターパス
 * 連続する点の集合で構成される図形
 */
export interface VectorPath {
  /** パスを構成する点の配列 */
  points: VectorPoint[]
  /** パスが閉じているかどうか */
  closed: boolean
  /** パスの細分化レベル（曲線の滑らかさ） */
  subdivision?: number
}

/**
 * パス作成用パラメータ
 */
export interface CreateVectorPathParams {
  points?: VectorPoint[]
  closed?: boolean
  subdivision?: number
}

/**
 * ベクターパス作成ファクトリー関数
 */
export function createVectorPath(
  params: CreateVectorPathParams = {},
): VectorPath {
  return {
    points: params.points || [],
    closed: params.closed || false,
    subdivision: params.subdivision || 10,
  }
}

/**
 * パスに点を追加
 */
export function addPointToPath(path: VectorPath, point: VectorPoint): void {
  path.points.push(point)
}

/**
 * パスから点を削除
 */
export function removePointFromPath(path: VectorPath, index: number): boolean {
  if (index >= 0 && index < path.points.length) {
    path.points.splice(index, 1)
    return true
  }
  return false
}

/**
 * パスの点を更新
 */
export function updatePointInPath(
  path: VectorPath,
  index: number,
  point: Partial<VectorPoint>,
): boolean {
  if (index >= 0 && index < path.points.length) {
    Object.assign(path.points[index], point)
    return true
  }
  return false
}

/**
 * パスの境界ボックスを計算
 */
export function getPathBounds(path: VectorPath): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  if (path.points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  let minX = path.points[0].x
  let minY = path.points[0].y
  let maxX = path.points[0].x
  let maxY = path.points[0].y

  for (const point of path.points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return { minX, minY, maxX, maxY }
}

/**
 * パスの長さを計算（近似値）
 */
export function getPathLength(path: VectorPath): number {
  if (path.points.length < 2) return 0

  let length = 0
  for (let i = 1; i < path.points.length; i++) {
    const prev = path.points[i - 1]
    const curr = path.points[i]
    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    length += Math.sqrt(dx * dx + dy * dy)
  }

  return length
}

/**
 * パスを単純化（Douglas-Peucker algorithm の簡易版）
 */
export function simplifyPath(
  path: VectorPath,
  tolerance: number = 1.0,
): VectorPath {
  if (path.points.length <= 2) return path

  const simplifiedPoints: VectorPoint[] = []

  // 最初と最後の点は必ず含める
  simplifiedPoints.push(path.points[0])

  for (let i = 1; i < path.points.length - 1; i++) {
    const prev = path.points[i - 1]
    const curr = path.points[i]
    const next = path.points[i + 1]

    // 前後の点との距離を計算
    const distPrev = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2)
    const distNext = Math.sqrt((curr.x - next.x) ** 2 + (curr.y - next.y) ** 2)

    // 閾値より大きい場合は点を残す
    if (distPrev > tolerance || distNext > tolerance) {
      simplifiedPoints.push(curr)
    }
  }

  simplifiedPoints.push(path.points[path.points.length - 1])

  return {
    ...path,
    points: simplifiedPoints,
  }
}
