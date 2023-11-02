/**
 * @author GPT-4
 */

import { SVGDCommand } from '@/fastsvg/IndexedPointAtLength'

type PathCommand = SVGDCommand
type Vector2Tuple = [number, number]

function splitCubicBezier(
  p0: Vector2Tuple,
  p1: Vector2Tuple,
  p2: Vector2Tuple,
  p3: Vector2Tuple,
  t: number
): [
  Vector2Tuple,
  Vector2Tuple,
  Vector2Tuple,
  Vector2Tuple,
  Vector2Tuple,
  Vector2Tuple,
  Vector2Tuple
] {
  const q0 = lerpPoint(p0, p1, t)
  const q1 = lerpPoint(p1, p2, t)
  const q2 = lerpPoint(p2, p3, t)

  const r0 = lerpPoint(q0, q1, t)
  const r1 = lerpPoint(q1, q2, t)

  const s0 = lerpPoint(r0, r1, t)

  return [p0, q0, r0, s0, r1, q2, p3]
}

function lerpPoint(a: Vector2Tuple, b: Vector2Tuple, t: number): Vector2Tuple {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function distance(a: Vector2Tuple, b: Vector2Tuple): number {
  return Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2))
}

function adaptiveSimpson(
  f: (t: number) => number,
  a: number,
  b: number,
  tolerance: number,
  maxRecursion: number = 10,
  wholeArea?: number
): number {
  if (wholeArea === undefined) {
    wholeArea = simpson(f, a, b)
  }

  const c = (a + b) / 2
  const leftArea = simpson(f, a, c)
  const rightArea = simpson(f, c, b)
  const area = leftArea + rightArea

  if (maxRecursion <= 0 || Math.abs(area - wholeArea) <= 15 * tolerance) {
    return area
  }

  return (
    adaptiveSimpson(f, a, c, tolerance / 2, maxRecursion - 1, leftArea) +
    adaptiveSimpson(f, c, b, tolerance / 2, maxRecursion - 1, rightArea)
  )
}

function simpson(f: (t: number) => number, a: number, b: number): number {
  const c = (a + b) / 2
  const h3 = Math.abs(b - a) / 6
  return h3 * (f(a) + 4 * f(c) + f(b))
}

function cubicBezierLength(
  p0: Vector2Tuple,
  p1: Vector2Tuple,
  p2: Vector2Tuple,
  p3: Vector2Tuple,
  tolerance = 1e-4
): number {
  const f1 = (t: number) => {
    const [x0, y0] = lerpPoint(p0, p1, t)
    const [x1, y1] = lerpPoint(p1, p2, t)
    const [x2, y2] = lerpPoint(p2, p3, t)
    const dx = 3 * (x1 - x0) + 3 * (x2 - x1) - 3 * x0 + p3[0]
    const dy = 3 * (y1 - y0) + 3 * (y2 - y1) - 3 * y0 + p3[1]
    return Math.sqrt(dx * dx + dy * dy)
  }

  return adaptiveSimpson(f1, 0, 1, tolerance)
}

export function splitPathAt(
  path: PathCommand[],
  length: number
): [PathCommand[], PathCommand[]] {
  let currentLength = 0
  let currentPoint: Vector2Tuple = [0, 0]
  const newPath1: PathCommand[] = []
  const newPath2: PathCommand[] = []

  for (const command of path) {
    const [c, ...params] = command

    if (c === 'M' || c === 'm') {
      newPath1.push(command)
      currentPoint = [params[0], params[1]]
    } else if (c === 'L' || c === 'l') {
      const p1: Vector2Tuple = [params[0], params[1]]
      const segmentLength = distance(currentPoint, p1)

      if (currentLength + segmentLength < length) {
        newPath1.push(command)
        currentLength += segmentLength
      } else {
        const t = (length - currentLength) / segmentLength
        const splitPoint = lerpPoint(currentPoint, p1, t)
        newPath1.push([c, splitPoint[0], splitPoint[1]])
        newPath2.push(['M', splitPoint[0], splitPoint[1]]) // Update this line
        newPath2.push([c, p1[0], p1[1]])
        currentLength += segmentLength
        currentPoint = p1
      }
    } else if (c === 'C' || c === 'c') {
      const p1: Vector2Tuple = [params[0], params[1]]
      const p2: Vector2Tuple = [params[2], params[3]]
      const p3: Vector2Tuple = [params[4], params[5]]
      const segmentLength = cubicBezierLength(currentPoint, p1, p2, p3)

      if (currentLength + segmentLength < length) {
        newPath1.push(command)
        currentLength += segmentLength
      } else {
        const t = (length - currentLength) / segmentLength
        const [sp0, sp1, sp2, sp3, sp4, sp5, sp6] = splitCubicBezier(
          currentPoint,
          p1,
          p2,
          p3,
          t
        )
        newPath1.push([c, sp1[0], sp1[1], sp2[0], sp2[1], sp3[0], sp3[1]])
        newPath2.push([c, sp4[0], sp4[1], sp5[0], sp5[1], sp6[0], sp6[1]])
        currentLength += segmentLength
        currentPoint = p3
      }
    } else if (c === 'Z' || c === 'z') {
      newPath1.push(command)
      newPath2.push(command)
    } else {
      newPath1.push(command)
      newPath2.push(command)
    }
  }

  return [newPath1, newPath2]
}
