import { pathBounds } from '@/fastsvg/pathBounds'

import { type VectorObject, type VectorPath } from '@/Document'
import { type VectorPathPoint } from '@/Document/LayerEntity/VectorPath'
import { shallowEqMemoize } from './shallowedMemoize'
import { type Point2D } from '@/Document/Struct/Point2D'
import { type SVGDCommand } from '@/fastsvg/IndexedPointAtLength'

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
  m.translateSelf(obj.position.x, obj.position.y)
  m.scaleSelf(obj.scale.x, obj.scale.y)
  m.rotateSelf(0, 0, obj.rotate)
  m.translateSelf(-bbx.width / 2, -bbx.height / 2)

  return [m.a, m.b, m.c, m.d, m.e, m.f] as const
}

export const calcVectorBoundingBox = (obj: VectorObject) => {
  const bbox = pathBounds(
    pointsToSVGCommandArray(obj.path.points, obj.path.closed),
  )
  const left = bbox.left + obj.position.x
  const top = bbox.top + obj.position.y
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

const memoized_pointsToSVGPath = shallowEqMemoize(
  (points) => points,
  pointsToSVGPath,
)

export function pointsToSVGCommandArray(
  points: VectorPathPoint[],
  closed: boolean,
): SVGDCommand[] {
  const [start] = points

  if (points.length === 1) {
    return [['M', start.x, start.y]]
  }

  return [
    ['M', start.x, start.y],
    ...[...points, ...(closed ? [start] : [])].map(
      (point, prev): SVGDCommand => {
        if (point!.end || point.begin) {
          return [
            'C',
            point.begin?.x ?? prev!.x,
            point.begin?.y ?? prev!.y,
            point.end?.x ?? point.x,
            point.end?.y ?? point.y,
            point.x,
            point.y,
          ]
        } else {
          return ['L', point.x, point.y]
        }
      },
    ),
    ...(closed ? [['Z'] as ['Z']] : []),
  ]
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
