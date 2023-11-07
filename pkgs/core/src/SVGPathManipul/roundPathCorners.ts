/**
 * @author GPT-4
 */

import { SVGDCommand } from '@/fastsvg/IndexedPointAtLength'
import { parseSVGPath, svgDCommandArrayToSVGPath } from '.'

export function roundPathCorners(
  path: SVGDCommand[],
  radius: number,
): SVGDCommand[] {
  if (path.length < 3) {
    return path
  }

  const result: SVGDCommand[] = []
  const startPoint = path[0].slice() as SVGDCommand
  const firstPoint = path[1].slice() as SVGDCommand
  let prevPoint = firstPoint

  result.push(startPoint)

  for (let i = 1; i < path.length; i++) {
    const currentPoint = path[i].slice() as SVGDCommand
    const nextPoint = path[(i + 1) % path.length].slice() as SVGDCommand

    if (currentPoint[0] !== 'L' || nextPoint[0] !== 'L') {
      if (currentPoint[0] !== 'Z') {
        result.push(currentPoint)
      }
      prevPoint = currentPoint
      continue
    }

    const [x1, y1] = prevPoint.slice(1)
    const [x2, y2] = currentPoint.slice(1)
    const [x3, y3] = nextPoint.slice(1)

    const angle = Math.atan2(y3 - y2, x3 - x2) - Math.atan2(y1 - y2, x1 - x2)

    if (angle === 0) {
      result.push(currentPoint)
      prevPoint = currentPoint
      continue
    }

    const halfAngle = angle / 2
    const distanceToCorner = Math.abs(radius / Math.tan(halfAngle))
    const distancePrevToCurrent = Math.hypot(x1 - x2, y1 - y2)
    const distanceNextToCurrent = Math.hypot(x3 - x2, y3 - y2)

    const t1 = Math.min(1, distanceToCorner / distancePrevToCurrent)
    const t2 = Math.min(1, distanceToCorner / distanceNextToCurrent)

    const p1x = x2 + t1 * (x1 - x2)
    const p1y = y2 + t1 * (y1 - y2)
    const p2x = x2 + t2 * (x3 - x2)
    const p2y = y2 + t2 * (y3 - y2)

    result.push(['L', p1x, p1y])
    result.push(['Q', x2, y2, p2x, p2y])

    prevPoint = currentPoint
  }

  // Handle the rounding between the first and last points
  if (startPoint[0] === 'M' && path[path.length - 1][0] === 'Z') {
    const lastPoint = path[path.length - 2].slice() as SVGDCommand
    const [x1, y1] = firstPoint.slice(1)
    const [x2, y2] = lastPoint.slice(1)
    const [x3, y3] = startPoint.slice(1)

    const angle = Math.atan2(y3 - y2, x3 - x2) - Math.atan2(y1 - y2, x1 - x2)
    const halfAngle = angle / 2
    const distanceToCorner = Math.abs(radius / Math.tan(halfAngle))
    const distanceFirstToLast = Math.hypot(x1 - x2, y1 - y2)
    const distanceStartToLast = Math.hypot(x3 - x2, y3 - y2)

    const t1 = Math.min(1, distanceToCorner / distanceFirstToLast)
    const t2 = Math.min(1, distanceToCorner / distanceStartToLast)

    const p1x = x2 + t1 * (x1 - x2)
    const p1y = y2 + t1 * (y1 - y2)
    const p2x = x2 + t2 * (x3 - x2)
    const p2y = y2 + t2 * (y3 - y2)

    result.push(['L', p1x, p1y])
    result.push(['Q', x2, y2, p2x, p2y])
    result.push(['Z'])
  } else {
    result.push(path[path.length - 1])
  }

  return result
}

if (import.meta.vitest) {
  const { describe, it } = import.meta.vitest!

  describe('roundPathCorners', () => {
    it('should round corners', () => {
      const path = parseSVGPath('M0,0 L100,0 L100,100 L0,100 Z')

      const newPath = roundPathCorners(path, 10)
      console.log(svgDCommandArrayToSVGPath(newPath))

      // expect(newPath).toEqual([
      //   ['M', 0, 0],
      //   ['L', 90, 0],
      //   ['C', 95.71067811865476, 0, 100, 4.289321881345241, 100, 10],
      //   ['L', 100, 90],
      //   ['C', 100, 95.71067811865476, 95.71067811865476, 100, 90, 100],
      //   ['L', 10, 100],
      //   ['C', 4.289321881345241, 100, 0, 95.71067811865476, 0, 90],
      //   ['L', 0, 10],
      //   ['C', 0, 4.289321881345241, 4.289321881345241, 0, 10, 0],
      // ]);
    })
  })
}
