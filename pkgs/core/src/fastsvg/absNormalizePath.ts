import { SVGDCommand } from './IndexedPointAtLength'
import { parseSVGPath } from './parse'
import abs from 'abs-svg-path'

export function absNormalizePath(path: string | SVGDCommand[]) {
  let norm = Array.isArray(path) ? path : parseSVGPath(path)
  norm = abs(norm)
  norm = zvhToL(norm)
  norm = longhand(norm)
  norm = qToC(norm)
  return norm
}

function qToC(path: SVGDCommand[]) {
  // SEE: https://codepen.io/enxaneta/post/quadratic-to-cubic-b-zier-in-svg
  // Written by GitHub Copilot

  const ret: SVGDCommand[] = [...path]
  let prevX = 0
  let prevY = 0

  for (let i = 0, len = ret.length; i < len; i++) {
    const [cmd, ...args] = ret[i]

    switch (cmd) {
      case 'M':
      case 'L':
      case 'C':
        prevX = args[args.length - 2] as number
        prevY = args[args.length - 1] as number
        break
      case 'Q': {
        const [x1, y1, x, y] = args as [number, number, number, number]
        const x0 = prevX
        const y0 = prevY
        const cx1 = x0 + (2 / 3) * (x1 - x0)
        const cy1 = y0 + (2 / 3) * (y1 - y0)
        const cx2 = cx1 + (1 / 3) * (x - x0)
        const cy2 = cy1 + (1 / 3) * (y - y0)
        ret[i] = ['C', cx1, cy1, cx2, cy2, x, y]

        prevX = x
        prevY = y

        break
      }
      case 'Z':
        break
      default:
        throw new Error(`WHAATT????? ${cmd}`)
        break
    }
  }

  return ret
}

/*!
  This is fork of below code
  https://github.com/substack/point-at-length
  https://unpkg.com/point-at-length@1.1.0/index.js
*/
// Expand shorthand curve commands to full versions; mutates the path in place for efficiency
// Requires commands have already been converted to absolute versions
function longhand(path: SVGDCommand[]) {
  let prev: SVGDCommand | null = null,
    x1 = 0,
    y1 = 0

  const conversion: Record<string, { to: string; x: number } | undefined> = {
    S: { to: 'C', x: 3 },
    T: { to: 'Q', x: 1 },
  }

  for (var i = 0, len = path.length; i < len; i++) {
    const cmd = path[i]
    const convert = conversion[cmd[0]]

    if (convert) {
      cmd[0] = convert.to
      if (prev) {
        if (prev[0] === convert.to) {
          x1 = 2 * (prev[convert.x + 2] as number) - (prev[convert.x] as number)
          y1 =
            2 * (prev[convert.x + 3] as number) -
            (prev[convert.x + 1] as number)
        } else {
          x1 = prev[prev.length - 2] as number
          y1 = prev[prev.length - 1] as number
        }
      }
      cmd.splice(1, 0, x1, y1)
    }

    prev = cmd
  }

  return path
}

/*!
  This is fork of below code
  https://github.com/substack/point-at-length
  https://unpkg.com/point-at-length@1.1.0/index.js
*/
// Convert 'Z', 'V' and 'H' segments to 'L' segments
function zvhToL(path: SVGDCommand[]) {
  var ret: SVGDCommand[] = []
  var startPoint: SVGDCommand = ['L', 0, 0]
  var last_point

  for (var i = 0, len = path.length; i < len; i++) {
    var pt = path[i]
    switch (pt[0]) {
      case 'M':
        startPoint = ['L', pt[1], pt[2]]
        ret.push(pt)
        break
      case 'Z':
        ret.push(startPoint)
        break
      case 'H':
        last_point = ret[ret.length - 1] || ['L', 0, 0]
        ret.push(['L', pt[1], last_point[last_point.length - 1] as number])
        break
      case 'V':
        last_point = ret[ret.length - 1] || ['L', 0, 0]
        ret.push(['L', last_point[last_point.length - 2] as number, pt[1]])
        break
      default:
        ret.push(pt)
    }
  }
  return ret
}
