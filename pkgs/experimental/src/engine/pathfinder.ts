import type { VectorPath } from './document/path'
import type { VectorPoint } from './document/types'

/**
 * パスファインダー操作の種類
 */
export type PathfinderOperation =
  | 'union' // 合体
  | 'difference' // 型抜き（前面オブジェクトで）
  | 'intersection' // 交差
  | 'exclusion' // 中窓（排他的論理和）
  | 'divide' // パスで分割

/**
 * パスファインダー操作の結果
 */
export interface PathfinderResult {
  /** 結果のパス配列 */
  paths: VectorPath[]
  /** 実行された操作 */
  operation: PathfinderOperation
  /** 元のパス配列 */
  originalPaths: VectorPath[]
  /** 操作の実行時刻 */
  timestamp: number
}

/**
 * 線分の交点情報
 */
interface LineIntersection {
  x: number
  y: number
  /** 第一線分上のパラメータ (0-1) */
  t: number
  /** 第二線分上のパラメータ (0-1) */
  u: number
}

/**
 * 2つの線分の交点を計算
 */
function lineSegmentIntersection(
  p1: VectorPoint,
  p2: VectorPoint,
  p3: VectorPoint,
  p4: VectorPoint,
): LineIntersection | null {
  const x1 = p1.x,
    y1 = p1.y
  const x2 = p2.x,
    y2 = p2.y
  const x3 = p3.x,
    y3 = p3.y
  const x4 = p4.x,
    y4 = p4.y

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denom) < 1e-10) return null

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
      t,
      u,
    }
  }
  return null
}

/**
 * 点がポリゴンの内部にあるかを判定（レイキャスト法）
 */
function pointInPolygon(point: VectorPoint, polygon: VectorPath): boolean {
  let inside = false
  const x = point.x,
    y = point.y
  const points = polygon.points

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x,
      yi = points[i].y
    const xj = points[j].x,
      yj = points[j].y

    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * ポリゴンの面積を計算（Shoelace formula）
 */
function calculatePolygonArea(points: VectorPoint[]): number {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area / 2)
}

/**
 * Sutherland-Hodgman クリッピング算法でポリゴンをクリップ
 */
function clipPolygonByEdge(
  subjectPoints: VectorPoint[],
  clipEdge: { start: VectorPoint; end: VectorPoint },
): VectorPoint[] {
  if (subjectPoints.length === 0) return []

  const clippedVertices: VectorPoint[] = []
  const startPoint = clipEdge.start
  const endPoint = clipEdge.end

  const edgeVector = {
    x: endPoint.x - startPoint.x,
    y: endPoint.y - startPoint.y,
  }
  const normal = { x: -edgeVector.y, y: edgeVector.x }

  function isInside(point: VectorPoint): boolean {
    const toPoint = { x: point.x - startPoint.x, y: point.y - startPoint.y }
    return normal.x * toPoint.x + normal.y * toPoint.y >= 0
  }

  if (subjectPoints.length > 0) {
    let previousVertex = subjectPoints[subjectPoints.length - 1]

    for (const currentVertex of subjectPoints) {
      if (isInside(currentVertex)) {
        if (!isInside(previousVertex)) {
          const intersection = lineSegmentIntersection(
            previousVertex,
            currentVertex,
            startPoint,
            endPoint,
          )
          if (intersection) {
            clippedVertices.push({ x: intersection.x, y: intersection.y })
          }
        }
        clippedVertices.push(currentVertex)
      } else if (isInside(previousVertex)) {
        const intersection = lineSegmentIntersection(
          previousVertex,
          currentVertex,
          startPoint,
          endPoint,
        )
        if (intersection) {
          clippedVertices.push({ x: intersection.x, y: intersection.y })
        }
      }
      previousVertex = currentVertex
    }
  }

  return clippedVertices
}

/**
 * Sutherland-Hodgman クリッピング算法
 */
function sutherlandHodgmanClip(
  subjectPath: VectorPath,
  clipPath: VectorPath,
): VectorPoint[] {
  let outputList = subjectPath.points.slice()

  for (let i = 0; i < clipPath.points.length; i++) {
    const clipEdge = {
      start: clipPath.points[i],
      end: clipPath.points[(i + 1) % clipPath.points.length],
    }
    outputList = clipPolygonByEdge(outputList, clipEdge)
  }

  return outputList
}

/**
 * 2つのパスを合体
 */
export function unionPaths(
  pathA: VectorPath,
  pathB: VectorPath,
): PathfinderResult {
  // 現在は簡易実装：両方のパスをそのまま返す
  // 実際の実装ではより複雑な算法が必要
  const resultPaths = [pathA, pathB]

  return {
    paths: resultPaths,
    operation: 'union',
    originalPaths: [pathA, pathB],
    timestamp: Date.now(),
  }
}

/**
 * pathBでpathAを型抜き
 */
export function differencePaths(
  pathA: VectorPath,
  pathB: VectorPath,
): PathfinderResult {
  // 現在は簡易実装：pathAのみを返す
  // 実際の実装ではpathBでpathAをクリップする必要がある
  const resultPaths = [pathA]

  return {
    paths: resultPaths,
    operation: 'difference',
    originalPaths: [pathA, pathB],
    timestamp: Date.now(),
  }
}

/**
 * 2つのパスの交差部分を取得
 */
export function intersectionPaths(
  pathA: VectorPath,
  pathB: VectorPath,
): PathfinderResult {
  const clippedPoints = sutherlandHodgmanClip(pathA, pathB)

  const resultPaths: VectorPath[] = []
  if (clippedPoints.length > 0) {
    resultPaths.push({
      points: clippedPoints,
      closed: true,
      subdivision: Math.max(pathA.subdivision || 10, pathB.subdivision || 10),
    })
  }

  return {
    paths: resultPaths,
    operation: 'intersection',
    originalPaths: [pathA, pathB],
    timestamp: Date.now(),
  }
}

/**
 * 2つのパスの排他的論理和（中窓）
 */
export function exclusionPaths(
  pathA: VectorPath,
  pathB: VectorPath,
): PathfinderResult {
  // 現在は簡易実装：両方のパスをそのまま返す
  // 実際の実装では交差部分を除外する必要がある
  const resultPaths = [pathA, pathB]

  return {
    paths: resultPaths,
    operation: 'exclusion',
    originalPaths: [pathA, pathB],
    timestamp: Date.now(),
  }
}

/**
 * 複数のパスで分割
 */
export function dividePaths(paths: VectorPath[]): PathfinderResult {
  // 現在は簡易実装：全てのパスをそのまま返す
  // 実際の実装では交点で分割する必要がある
  const resultPaths = paths.slice()

  return {
    paths: resultPaths,
    operation: 'divide',
    originalPaths: paths,
    timestamp: Date.now(),
  }
}

/**
 * パスファインダー操作のメイン関数
 */
export function performPathfinder(
  operation: PathfinderOperation,
  paths: VectorPath[],
): PathfinderResult {
  if (paths.length < 2) {
    throw new Error('パスファインダー操作には最低2つのパスが必要です')
  }

  const [pathA, pathB, ...restPaths] = paths

  switch (operation) {
    case 'union':
      if (restPaths.length > 0) {
        let result = unionPaths(pathA, pathB)
        for (const path of restPaths) {
          result = unionPaths(result.paths[0], path)
        }
        return result
      }
      return unionPaths(pathA, pathB)

    case 'difference':
      return differencePaths(pathA, pathB)

    case 'intersection':
      if (restPaths.length > 0) {
        let result = intersectionPaths(pathA, pathB)
        for (const path of restPaths) {
          if (result.paths.length > 0) {
            result = intersectionPaths(result.paths[0], path)
          }
        }
        return result
      }
      return intersectionPaths(pathA, pathB)

    case 'exclusion':
      return exclusionPaths(pathA, pathB)

    case 'divide':
      return dividePaths(paths)

    default:
      throw new Error(`未対応のパスファインダー操作: ${operation}`)
  }
}

/**
 * ベジェ曲線の情報
 */
interface BezierCurve {
  p0: VectorPoint
  p1: VectorPoint
  p2: VectorPoint
  p3: VectorPoint
}

/**
 * ベジェ曲線の交点情報
 */
interface BezierIntersection {
  point: VectorPoint
  t1: number
  t2: number
  distance: number
}

/**
 * 3次ベジェ曲線を評価
 */
function evaluateCubicBezier(
  p0: VectorPoint,
  p1: VectorPoint,
  p2: VectorPoint,
  p3: VectorPoint,
  t: number,
): VectorPoint {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  }
}

/**
 * 2次ベジェ曲線を評価
 */
function evaluateQuadraticBezier(
  p0: VectorPoint,
  p1: VectorPoint,
  p2: VectorPoint,
  t: number,
): VectorPoint {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t

  return {
    x: mt2 * p0.x + 2 * mt * t * p1.x + t2 * p2.x,
    y: mt2 * p0.y + 2 * mt * t * p1.y + t2 * p2.y,
  }
}

/**
 * ベジェ曲線の境界ボックスを計算
 */
function getBezierBounds(curve: BezierCurve): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  const { p0, p1, p2, p3 } = curve
  return {
    minX: Math.min(p0.x, p1.x, p2.x, p3.x),
    maxX: Math.max(p0.x, p1.x, p2.x, p3.x),
    minY: Math.min(p0.y, p1.y, p2.y, p3.y),
    maxY: Math.max(p0.y, p1.y, p2.y, p3.y),
  }
}

/**
 * 境界ボックスの交差判定
 */
function boundsIntersect(
  bounds1: { minX: number; maxX: number; minY: number; maxY: number },
  bounds2: { minX: number; maxX: number; minY: number; maxY: number },
): boolean {
  return !(
    bounds1.maxX < bounds2.minX ||
    bounds2.maxX < bounds1.minX ||
    bounds1.maxY < bounds2.minY ||
    bounds2.maxY < bounds1.minY
  )
}

/**
 * パスセグメントを適応的に細分化
 */
function subdividePathSegment(
  startPoint: VectorPoint,
  endPoint: VectorPoint,
  maxError = 0.5,
  maxDepth = 6,
): VectorPoint[] {
  if (startPoint.handleOut || endPoint.handleIn) {
    return subdivideBezierSegment(startPoint, endPoint, maxError, maxDepth)
  }
  return [startPoint, endPoint]
}

/**
 * ベジェ曲線セグメントの適応的細分化
 */
function subdivideBezierSegment(
  startPoint: VectorPoint,
  endPoint: VectorPoint,
  maxError = 0.5,
  maxDepth = 6,
  depth = 0,
): VectorPoint[] {
  if (depth >= maxDepth) {
    return [startPoint, endPoint]
  }

  const p0 = startPoint
  const p1 = startPoint.handleOut
    ? {
        x: startPoint.x + startPoint.handleOut.x,
        y: startPoint.y + startPoint.handleOut.y,
      }
    : startPoint
  const p2 = endPoint.handleIn
    ? {
        x: endPoint.x + endPoint.handleIn.x,
        y: endPoint.y + endPoint.handleIn.y,
      }
    : endPoint
  const p3 = endPoint

  const midPoint = evaluateCubicBezier(p0, p1, p2, p3, 0.5)

  const lineStart = { x: p0.x, y: p0.y }
  const lineEnd = { x: p3.x, y: p3.y }
  const distance = distanceToLine(midPoint, lineStart, lineEnd)

  if (distance < maxError) {
    return [startPoint, endPoint]
  }

  const midVectorPoint: VectorPoint = { x: midPoint.x, y: midPoint.y }

  const leftSegment = subdivideBezierSegment(
    startPoint,
    midVectorPoint,
    maxError,
    maxDepth,
    depth + 1,
  )
  const rightSegment = subdivideBezierSegment(
    midVectorPoint,
    endPoint,
    maxError,
    maxDepth,
    depth + 1,
  )

  return [...leftSegment.slice(0, -1), ...rightSegment]
}

/**
 * 点と直線の距離を計算
 */
function distanceToLine(
  point: VectorPoint,
  lineStart: VectorPoint,
  lineEnd: VectorPoint,
): number {
  const A = point.x - lineStart.x
  const B = point.y - lineStart.y
  const C = lineEnd.x - lineStart.x
  const D = lineEnd.y - lineStart.y

  const dot = A * C + B * D
  const lenSq = C * C + D * D

  if (lenSq === 0) return Math.sqrt(A * A + B * B)

  const param = dot / lenSq
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
 * ベジェ曲線同士の交点を検出
 */
function findBezierIntersections(
  curve1: BezierCurve,
  curve2: BezierCurve,
  tolerance = 0.1,
): BezierIntersection[] {
  const bounds1 = getBezierBounds(curve1)
  const bounds2 = getBezierBounds(curve2)

  if (!boundsIntersect(bounds1, bounds2)) {
    return []
  }

  return findBezierIntersectionsRecursive(curve1, curve2, 0, 1, 0, 1, tolerance)
}

/**
 * ベジェ曲線交点の再帰的検出
 */
function findBezierIntersectionsRecursive(
  curve1: BezierCurve,
  curve2: BezierCurve,
  t1Min: number,
  t1Max: number,
  t2Min: number,
  t2Max: number,
  tolerance: number,
  depth = 0,
): BezierIntersection[] {
  if (depth > 10) return []

  const t1Mid = (t1Min + t1Max) * 0.5
  const t2Mid = (t2Min + t2Max) * 0.5

  const point1 = evaluateCubicBezier(
    curve1.p0,
    curve1.p1,
    curve1.p2,
    curve1.p3,
    t1Mid,
  )
  const point2 = evaluateCubicBezier(
    curve2.p0,
    curve2.p1,
    curve2.p2,
    curve2.p3,
    t2Mid,
  )

  const distance = Math.sqrt(
    (point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2,
  )

  if (distance < tolerance) {
    return [{ point: point1, t1: t1Mid, t2: t2Mid, distance }]
  }

  if (t1Max - t1Min < 0.001 || t2Max - t2Min < 0.001) {
    return []
  }

  const intersections: BezierIntersection[] = []
  const subdivisions = [
    [t1Min, t1Mid, t2Min, t2Mid],
    [t1Mid, t1Max, t2Min, t2Mid],
    [t1Min, t1Mid, t2Mid, t2Max],
    [t1Mid, t1Max, t2Mid, t2Max],
  ]

  for (const [t1Start, t1End, t2Start, t2End] of subdivisions) {
    intersections.push(
      ...findBezierIntersectionsRecursive(
        curve1,
        curve2,
        t1Start,
        t1End,
        t2Start,
        t2End,
        tolerance,
        depth + 1,
      ),
    )
  }

  return intersections
}

/**
 * パスの自己交差を検出
 */
function findSelfIntersections(
  path: VectorPath,
): Array<{ point: VectorPoint; segment1: number; segment2: number }> {
  const intersections: Array<{
    point: VectorPoint
    segment1: number
    segment2: number
  }> = []

  for (let i = 0; i < path.points.length - 1; i++) {
    for (let j = i + 2; j < path.points.length - 1; j++) {
      if (Math.abs(i - j) <= 1) continue

      const seg1Start = path.points[i]
      const seg1End = path.points[i + 1]
      const seg2Start = path.points[j]
      const seg2End = path.points[j + 1]

      const intersection = lineSegmentIntersection(
        seg1Start,
        seg1End,
        seg2Start,
        seg2End,
      )
      if (intersection) {
        intersections.push({
          point: { x: intersection.x, y: intersection.y },
          segment1: i,
          segment2: j,
        })
      }
    }
  }

  return intersections
}

/**
 * 複雑なパス（曲線を含む）を直線セグメントに変換
 */
function convertPathToLineSegments(
  path: VectorPath,
  maxError = 0.5,
  maxDepth = 6,
): VectorPath {
  const linearPoints: VectorPoint[] = []

  for (let i = 0; i < path.points.length; i++) {
    const currentPoint = path.points[i]
    const nextPoint = path.points[(i + 1) % path.points.length]

    if (i === path.points.length - 1 && !path.closed) {
      linearPoints.push(currentPoint)
      break
    }

    const subdivided = subdividePathSegment(
      currentPoint,
      nextPoint,
      maxError,
      maxDepth,
    )
    if (i === 0) {
      linearPoints.push(...subdivided)
    } else {
      linearPoints.push(...subdivided.slice(1))
    }
  }

  return {
    points: linearPoints,
    closed: path.closed,
    subdivision: path.subdivision,
  }
}

/**
 * 三角形の情報
 */
interface Triangle {
  vertices: [VectorPoint, VectorPoint, VectorPoint]
  area: number
}

/**
 * Ear Clipping 算法でポリゴンを三角分割
 */
function triangulatePolygon(vertices: VectorPoint[]): Triangle[] {
  if (vertices.length < 3) return []

  const workingVertices = vertices.slice()
  const triangles: Triangle[] = []

  // 時計回りかどうかをチェック
  const area = calculateSignedArea(workingVertices)
  if (area > 0) {
    workingVertices.reverse()
  }

  let n = workingVertices.length
  let count = 2 * n

  for (let v = n - 1; n > 2; ) {
    if (count-- <= 0) break

    const u = v
    if (n <= u) v = 0
    v = u + 1
    if (n <= v) v = 0
    let w = v + 1
    if (n <= w) w = 0

    if (isEar(u, v, w, workingVertices)) {
      const triangle: Triangle = {
        vertices: [
          { ...workingVertices[u] },
          { ...workingVertices[v] },
          { ...workingVertices[w] },
        ],
        area: calculateTriangleArea(
          workingVertices[u],
          workingVertices[v],
          workingVertices[w],
        ),
      }
      triangles.push(triangle)

      workingVertices.splice(v, 1)
      n--
      count = 2 * n
    }
  }

  return triangles
}

/**
 * 符号付き面積を計算
 */
function calculateSignedArea(vertices: VectorPoint[]): number {
  let area = 0
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length
    area += (vertices[j].x - vertices[i].x) * (vertices[j].y + vertices[i].y)
  }
  return area / 2
}

/**
 * 耳かどうかを判定
 */
function isEar(
  u: number,
  v: number,
  w: number,
  vertices: VectorPoint[],
): boolean {
  const A = vertices[u]
  const B = vertices[v]
  const C = vertices[w]

  if (!isConvexAngle(A, B, C)) return false

  for (let p = 0; p < vertices.length; p++) {
    if (p === u || p === v || p === w) continue

    if (pointInTriangle(vertices[p], A, B, C)) {
      return false
    }
  }

  return true
}

/**
 * 凸角かどうかを判定
 */
function isConvexAngle(
  A: VectorPoint,
  B: VectorPoint,
  C: VectorPoint,
): boolean {
  return cross2D(subtract2D(C, B), subtract2D(A, B)) >= 0
}

/**
 * 2D外積
 */
function cross2D(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return a.x * b.y - a.y * b.x
}

/**
 * 2Dベクトル減算
 */
function subtract2D(a: VectorPoint, b: VectorPoint): { x: number; y: number } {
  return { x: a.x - b.x, y: a.y - b.y }
}

/**
 * 2D内積
 */
function dot2D(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return a.x * b.x + a.y * b.y
}

/**
 * 点が三角形内部にあるかを判定（重心座標使用）
 */
function pointInTriangle(
  P: VectorPoint,
  A: VectorPoint,
  B: VectorPoint,
  C: VectorPoint,
): boolean {
  const v0 = subtract2D(C, A)
  const v1 = subtract2D(B, A)
  const v2 = subtract2D(P, A)

  const dot00 = dot2D(v0, v0)
  const dot01 = dot2D(v0, v1)
  const dot02 = dot2D(v0, v2)
  const dot11 = dot2D(v1, v1)
  const dot12 = dot2D(v1, v2)

  const invDenom = 1 / (dot00 * dot11 - dot01 * dot01)
  const u = (dot11 * dot02 - dot01 * dot12) * invDenom
  const v = (dot00 * dot12 - dot01 * dot02) * invDenom

  return u >= 0 && v >= 0 && u + v <= 1
}

/**
 * 三角形の面積を計算
 */
function calculateTriangleArea(
  A: VectorPoint,
  B: VectorPoint,
  C: VectorPoint,
): number {
  return Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y)) / 2
}

/**
 * 複雑なパスを高度に処理（曲線の細分化と三角分割を組み合わせ）
 */
function processComplexPath(
  path: VectorPath,
  maxError = 0.5,
  maxDepth = 6,
): {
  linearPath: VectorPath
  triangles: Triangle[]
  intersections: Array<{
    point: VectorPoint
    segment1: number
    segment2: number
  }>
} {
  // 1. 曲線を直線に変換
  const linearPath = convertPathToLineSegments(path, maxError, maxDepth)

  // 2. 自己交差を検出
  const intersections = findSelfIntersections(linearPath)

  // 3. 三角分割を実行（閉じたパスの場合のみ）
  let triangles: Triangle[] = []
  if (linearPath.closed && linearPath.points.length >= 3) {
    triangles = triangulatePolygon(linearPath.points)
  }

  return {
    linearPath,
    triangles,
    intersections,
  }
}

/**
 * 高度なパスファインダー操作（曲線対応版）
 */
export function advancedUnionPaths(
  pathA: VectorPath,
  pathB: VectorPath,
  tolerance = 0.5,
): PathfinderResult {
  // 両方のパスを直線セグメントに変換
  const linearA = convertPathToLineSegments(pathA, tolerance)
  const linearB = convertPathToLineSegments(pathB, tolerance)

  // 現在は簡易実装：両方をそのまま結合
  const resultPaths = [linearA, linearB]

  return {
    paths: resultPaths,
    operation: 'union',
    originalPaths: [pathA, pathB],
    timestamp: Date.now(),
  }
}

/**
 * 高度な交差操作（曲線対応版）
 */
export function advancedIntersectionPaths(
  pathA: VectorPath,
  pathB: VectorPath,
  tolerance = 0.5,
): PathfinderResult {
  const linearA = convertPathToLineSegments(pathA, tolerance)
  const linearB = convertPathToLineSegments(pathB, tolerance)

  const clippedPoints = sutherlandHodgmanClip(linearA, linearB)

  const resultPaths: VectorPath[] = []
  if (clippedPoints.length > 0) {
    resultPaths.push({
      points: clippedPoints,
      closed: true,
      subdivision: Math.max(pathA.subdivision || 10, pathB.subdivision || 10),
    })
  }

  return {
    paths: resultPaths,
    operation: 'intersection',
    originalPaths: [pathA, pathB],
    timestamp: Date.now(),
  }
}

/**
 * 高度な型抜き操作（曲線対応版）
 */
export function advancedDifferencePaths(
  pathA: VectorPath,
  pathB: VectorPath,
  tolerance = 0.5,
): PathfinderResult {
  const linearA = convertPathToLineSegments(pathA, tolerance)
  convertPathToLineSegments(pathB, tolerance) // linearB変数削除によるwarning回避

  // 現在は簡易実装：pathAのみを返す
  const resultPaths = [linearA]

  return {
    paths: resultPaths,
    operation: 'difference',
    originalPaths: [pathA, pathB],
    timestamp: Date.now(),
  }
}

/**
 * パスファインダー操作のヘルパー関数群
 */
export const Pathfinder = {
  union: unionPaths,
  difference: differencePaths,
  intersection: intersectionPaths,
  exclusion: exclusionPaths,
  divide: dividePaths,
  perform: performPathfinder,

  /** 高度な操作（曲線対応） */
  advanced: {
    union: advancedUnionPaths,
    intersection: advancedIntersectionPaths,
    difference: advancedDifferencePaths,
    processComplexPath,
  },

  /** ユーティリティ関数 */
  utils: {
    pointInPolygon,
    calculatePolygonArea,
    lineSegmentIntersection,
    sutherlandHodgmanClip,
    evaluateCubicBezier,
    evaluateQuadraticBezier,
    subdividePathSegment,
    findBezierIntersections,
    findSelfIntersections,
    convertPathToLineSegments,
    getBezierBounds,
    distanceToLine,
    triangulatePolygon,
    calculateTriangleArea,
    pointInTriangle,
    cross2D,
    dot2D,
  },
}
