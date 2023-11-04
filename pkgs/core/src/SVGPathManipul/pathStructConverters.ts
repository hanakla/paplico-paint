import { type SVGDCommand } from '@/fastsvg/IndexedPointAtLength'
import { type VectorPath } from '@/Document'
import { type VectorPathPoint } from '@/Document/LayerEntity/VectorPath'

export function svgDCommandArrayToSVGPathString(
  pathCommands: SVGDCommand[],
): string {
  return pathCommands
    .map((command) => {
      const [cmd, ...params] = command
      return `${cmd}${params.join(',')}`
    })
    .join(' ')
}

/** @deprecated use `vectorPathPointsToSVGDCommandArray` instead  */
export function vectorPathToSVGPathString({ points }: VectorPath) {
  return vectorPathPointsToSVGPathString(points)
}

export function vectorPathPointsToSVGPathString(points: VectorPathPoint[]) {
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
  }

  return d.join(' ')
}

export function vectorPathPointsToSVGCommandArray(
  points: VectorPathPoint[],
): SVGDCommand[] {
  const commands: SVGDCommand[] = []

  for (let idx = 0, l = points.length; idx < l; idx++) {
    const pt = points[idx]
    const prev = points[idx - 1]

    if (pt.isMoveTo) {
      commands.push(['M', pt.x, pt.y])
    } else if (pt.isClose) {
      commands.push(['Z'])
    } else if (pt.begin == null && pt.end === null) {
      commands.push(['L', pt.x, pt.y])
    } else {
      // prettier-ignore
      commands.push([
        'C',
        pt.begin?.x ?? prev.x, pt.begin?.y ?? prev.y,
        pt.end?.x ?? pt.x, pt.end?.y ?? pt.y,
        pt.x, pt.y
      ])
    }
  }

  return commands
}
