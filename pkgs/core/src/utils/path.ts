import { VectorPath } from '@/Document'
import { mapPoints } from '@/stroking-utils'

export function pathToSVGPath(path: VectorPath) {
  const [start, ...points] = path.points
  const d: string[] = []

  d.push(`M ${start.x} ${start.y}`)

  mapPoints(points, (point, prev) => {
    if (point.begin || point.end) {
      d.push(
        [
          'C',
          [point.begin?.x ?? prev!.x, point.begin?.y ?? prev!.y].join(','),
          [point.end?.x ?? point.x, point.end?.y ?? point.y].join(','),
          [point.x, point.y].join(','),
        ].join(' '),
      )
    } else if (point.begin == null && point.end == null) {
      d.push(['L', [point.x, point.y].join(',')].join(' '))
    }
  })

  return d.join(' ')
}
