import { VectorPath } from '@/Document'

export function pathToSVGPath({ points }: VectorPath) {
  const d: string[] = []

  for (let idx = 0, l = points.length; idx < l; idx++) {
    const prev = points[idx - 1]
    const point = points[idx]

    if (point.isMoveTo) {
      d.push(`M ${point.x} ${point.y}`)
    } else if (point.isClose) {
      d.push(`Z`)
    } else {
      if (idx === 0) {
        throw new Error('pathToSVGPath: First point must be moveTo')
      }

      d.push(
        [
          'C',
          [point.begin?.x ?? prev!.x, point.begin?.y ?? prev!.y].join(','),
          [point.end?.x ?? point.x, point.end?.y ?? point.y].join(','),
          [point.x, point.y].join(','),
        ].join(' '),
      )
    }

    return d.join(' ')
  }

  return d.join(' ')
}
