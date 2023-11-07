import { type SVGDCommand } from '@/fastsvg/IndexedPointAtLength'
import { VisuElement } from '@/Document'
import { absNormalizePath } from '@/fastsvg/absNormalizePath'

export function svgDCommandArrayToSVGPath(pathCommands: SVGDCommand[]): string {
  return pathCommands
    .map((command) => {
      const [cmd, ...params] = command
      return `${cmd}${params.join(',')}`
    })
    .join(' ')
}

export function svgPathToVisuVectorPath(
  pathStr: string,
  splitByM: boolean = false,
): VisuElement.VectorPath {
  // FIXME: Boolean path
  let norm = absNormalizePath(pathStr)

  let vectorPath: VisuElement.VectorPath = {
    fillRule: 'nonzero',
    points: [],
    randomSeed: 0,
  }

  for (const [cmd, ...args] of norm) {
    if (cmd === 'M') {
      if (splitByM) {
        vectorPath.points.push({
          isMoveTo: true,
          x: args[0],
          y: args[1],
        })
      }

      vectorPath.points.push({
        isMoveTo: true,
        x: args[0],
        y: args[1],
      })
    } else if (cmd === 'L') {
      vectorPath.points.push({
        x: args[0],
        y: args[1],
        begin: null,
        end: null,
      })
    } else if (cmd === 'C') {
      vectorPath.points.push({
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
      vectorPath.points.push({
        isClose: true,
      })
    }
  }

  return vectorPath
}

export function parseSVGPathToVisuVectorPath(
  d: string,
): VisuElement.VectorPath {
  const pathCommands = d
  const points = svgDCommandArrayToVectorPathPoints(pathCommands)
  return {
    fillRule: 'nonzero',
    points,
  }
}

export function vectorPathPointsToSVGPath(
  points: VisuElement.VectorPathPoint[],
) {
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
  points: VisuElement.VectorPathPoint[],
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
