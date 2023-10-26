import { pathBounds } from '@/fastsvg/pathBounds'

import { type VectorObject } from '@/Document'
import { type VectorPathPoint } from '@/Document/LayerEntity/VectorPath'
import { type Point2D } from '@/Document/Struct/Point2D'
import { pointsToSVGCommandArray } from '@/StrokingHelper'

export const addPoint2D = (a: Point2D, b: Point2D) => ({
  x: a.x + b.x,
  y: a.y + b.y,
})

export const multiplyPoint2D = (a: Point2D, b: Point2D) => ({
  x: a.x * b.x,
  y: a.y * b.y,
})

export const vectorTransformToMatrix = (obj: VectorObject) => {
  const m = new DOMMatrix()
  const bbx = calcVectorBoundingBox(obj)

  m.translateSelf(bbx.width / 2, bbx.height / 2)
  m.translateSelf(obj.transform.position.x, obj.transform.position.y)
  m.scaleSelf(obj.transform.scale.x, obj.transform.scale.y)
  m.rotateSelf(0, 0, obj.transform.rotate)
  m.translateSelf(-bbx.width / 2, -bbx.height / 2)

  return [m.a, m.b, m.c, m.d, m.e, m.f] as const
}

export const calcVectorBoundingBox = (obj: VectorObject) => {
  const bbox = pathBounds(
    pointsToSVGCommandArray(obj.path.points, obj.path.closed),
  )
  const left = bbox.left + obj.transform.position.x
  const top = bbox.top + obj.transform.position.y
  const width = Math.abs(bbox.right - bbox.left)
  const height = Math.abs(bbox.bottom - bbox.top)

  return {
    ...bbox,
    left,
    top,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
    width,
    height,
  }
}

/** @deprecated */
export function pointsToSVGPath(points: VectorPathPoint[], closed: boolean) {
  const [start] = points

  if (points.length === 1) {
    return `M${start.x},${start.y}`
  }

  return [
    `M${start.x},${start.y}`,
    mapPoints(
      [...points, ...(closed ? [points[0]] : [])],
      (point, prev) => {
        if (prev!.begin && point.end) {
          return `C ${prev!.begin.x},${prev!.begin.y} ${point.end.x},${
            point.end.y
          } ${point.x} ${point.y}`
        } else if (prev!.begin == null && point.end) {
          return `C ${prev!.x},${prev!.y} ${point.end.x},${point.end.y} ${
            point.x
          } ${point.y}`
        } else if (prev!.begin && point.end == null) {
          return `C ${prev!.begin.x},${prev!.begin.y} ${point.x},${point.y} ${
            point.x
          } ${point.y}`
        } else {
          return `L ${point.x} ${point.y}`
        }
      },
      { startOffset: 1 },
    ).join(' '),
    closed ? 'Z' : '',
  ].join(' ')
}

export function mapPoints<T extends VectorPathPoint, R>(
  points: T[],
  proc: (
    point: T,
    prevPoint: VectorPathPoint | undefined,
    index: number,
    points: T[],
  ) => R,
  { startOffset = 0 }: { startOffset?: number } = {},
): R[] {
  // const result: T[] = [] as any
  return points
    .slice(startOffset)
    .map((point, idx) =>
      proc(point, points[idx + startOffset - 1], idx, points),
    )
}
