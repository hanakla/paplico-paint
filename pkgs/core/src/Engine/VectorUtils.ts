import { pathBounds } from '@/fastsvg/pathBounds'
import { type VectorObject } from '@/Document'
import {
  VectorPath,
  type VectorPathPoint,
} from '@/Document/LayerEntity/VectorPath'
import { type Point2D } from '@/Document/Struct/Point2D'
import { pointsToSVGCommandArray } from '@/stroking-utils'
import { absNormalizePath } from '@/fastsvg/absNormalizePath'
import DOMMatrix from '@thednp/dommatrix'
import { LayerTransform } from '@/Document/LayerEntity'

export const addPoint2D = (a: Point2D, b: Point2D) => ({
  x: a.x + b.x,
  y: a.y + b.y,
})

export const multiplyPoint2D = (a: Point2D, b: Point2D) => ({
  x: a.x * b.x,
  y: a.y * b.y,
})

export const matrixToCanvasMatrix = (m: DOMMatrix) => {
  return [m.a, m.b, m.c, m.d, m.e, m.f] as const
}

export const layerTransformToMatrix = (trns: LayerTransform) => {
  return new DOMMatrix()
    .translate(trns.position.x, trns.position.y)
    .scale(trns.scale.x, trns.scale.y)
    .rotate(0, 0, trns.rotate)
}

export const vectorObjectTransformToMatrix = (obj: VectorObject) => {
  const bbx = calcVectorBoundingBox(obj)

  return new DOMMatrix()
    .translate(bbx.width / 2, bbx.height / 2)
    .translate(obj.transform.position.x, obj.transform.position.y)
    .scale(obj.transform.scale.x, obj.transform.scale.y)
    .rotate(0, 0, obj.transform.rotate)
    .translate(-bbx.width / 2, -bbx.height / 2)
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

export function svgCommandToVectoPath(path: string): VectorPath[] {
  // FIXME: Boolean path
  let norm = absNormalizePath(path)

  const paths: VectorPath[] = []
  let currentPath: VectorPath = {
    points: [],
    closed: false,
    randomSeed: 0,
  }

  for (const [cmd, ...args] of norm) {
    if (cmd === 'M') {
      currentPath = {
        points: [],
        closed: false,
        randomSeed: 0,
      }
      paths.push(currentPath)
    } else if (cmd === 'L') {
      currentPath.points.push({
        x: args[0],
        y: args[1],
        begin: null,
        end: null,
      })
    } else if (cmd === 'C') {
      currentPath.points.push({
        x: args[4],
        y: args[5],
        begin: {
          x: args[0],
          y: args[1],
        },
        end: {
          x: args[2],
          y: args[3],
        },
      })
    } else if (cmd === 'Q') {
      throw new Error('Quadratic Bezier is not supported')
    } else if (cmd === 'Z') {
      currentPath.closed = true
    }
  }

  return paths
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
