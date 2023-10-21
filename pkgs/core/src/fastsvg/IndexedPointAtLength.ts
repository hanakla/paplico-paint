/*
This is fork of below code
  https://github.com/substack/point-at-length
  https://unpkg.com/point-at-length@1.1.0/index.js

For faster point-at-length searching
*/

import { parseSVGPath } from './parse'
import abs from 'abs-svg-path'

export type SVGDCommand = [cmd: string, ...args: number[]]

type AtOption = {
  fromSubvertIndex?: number
  /** for benchmark use, it's decreasings performance */
  noBinsearch?: boolean
}

type Position2D = { x: number; y: number }
type VertexPosition = { x: number; y: number; len: number }

type SubvertData = {
  pos: Position2D

  div: number | null
  svgVertIdx: number
  prev: VertexPosition
  fragStartPos: Position2D
}

type AtResult = Readonly<{
  length: number
  pos: readonly [number, number]
  latestSubvertIdx: number
  _filled?: boolean
}>

export const indexedPointAtLength = (path: string | Array<SVGDCommand>) => {
  return new IndexedPointAtLength(path)
}

const SUBDIVIDES = 100

export class IndexedPointAtLength {
  protected _path: Array<SVGDCommand>
  protected _length: number = 0

  public readonly _lengthAtSubvert: number[] = []
  public readonly _lengthAtSVGVert: number[] = []
  public readonly _subvertIndex: SubvertData[] = []

  public static atBatch(path: string | Array<SVGDCommand>, pos: number[]) {
    const normPath = normalizePath(path)
    const walk = IndexedPointAtLength.prototype._walk

    return walk.call({ _path: normPath }, pos, {
      warm: false,
      fromSubvertIndex: undefined,
    })
  }

  constructor(path: string | Array<SVGDCommand>) {
    this._path = normalizePath(path)
    const warm = this._walk(null, { warm: true })
    this._length = warm[0].length
  }

  public get totalLength() {
    return this._length
  }

  public get vertexCount() {
    return this._path.length
  }

  public lengthOfVertex(vertIdx: number) {
    const length = this._lengthAtSVGVert[vertIdx]

    if (length == null) {
      throw new Error(`Vertex index out of bound: ${vertIdx}`)
    }

    return length
  }

  public at(pos: number, opts: AtOption = {}) {
    return this.atWithDetail(pos, opts).pos
  }

  /**
   * @param pos sorted array of position
   */
  public atBatch(pos: number[]) {
    return this._walk(pos)
  }

  public atWithDetail(pos: number, opts: AtOption = {}) {
    let nearPrevIdx: number | undefined

    if (!opts.noBinsearch && opts.fromSubvertIndex == null) {
      nearPrevIdx = binarySearch(this._lengthAtSubvert, pos)
    }

    return this._walk([pos], {
      fromSubvertIndex: opts.fromSubvertIndex ?? nearPrevIdx,
    })[0]
  }

  public getSequencialReader() {
    return new SequencialPointAtLength(this)
  }

  protected _walk(
    requests: number[] | null,
    {
      warm,
      fromSubvertIndex,
    }: {
      warm?: boolean
      fromSubvertIndex?: number
    } = {},
  ): AtResult[] {
    const { _subvertIndex, _lengthAtSubvert, _lengthAtSVGVert } = this

    let searchingIdx = 0
    const results: AtResult[] = []

    const cursor: VertexPosition = { x: 0, y: 0, len: 0 }
    let recentTailPos: Readonly<VertexPosition> = {
      x: 0,
      y: 0,
      len: 0,
    }

    // Restore the state before fragment pos calculation
    const indexedSubdivBeginState = fromSubvertIndex
      ? _subvertIndex[fromSubvertIndex]
      : null
    const beginSvgVertIndex = warm
      ? 0
      : indexedSubdivBeginState?.svgVertIdx ?? 0
    let currentSubvertIdx = fromSubvertIndex ?? 0

    Object.assign(cursor, indexedSubdivBeginState?.prev ?? cursor)
    Object.assign(recentTailPos, indexedSubdivBeginState?.prev ?? recentTailPos)

    for (
      let svgVertIdx = beginSvgVertIndex;
      svgVertIdx < this._path.length;
      svgVertIdx++
    ) {
      const currentCommand = this._path[svgVertIdx]

      if (currentCommand[0] === 'M') {
        const recent = {
          x: indexedSubdivBeginState?.fragStartPos.x ?? cursor.x,
          y: indexedSubdivBeginState?.fragStartPos.y ?? cursor.y,
          len: cursor.len,
        }

        cursor.x = currentCommand[1]
        cursor.y = currentCommand[2]

        currentSubvertIdx++
        if (warm) {
          _lengthAtSubvert.push(cursor.len)

          _subvertIndex.push({
            pos: { ...cursor },

            div: null,
            svgVertIdx,
            prev: { ...recent },
            fragStartPos: { x: cursor.x, y: cursor.y },
          })

          _lengthAtSVGVert.push(cursor.len)
        }

        if (requests && requests[searchingIdx] === 0) {
          results.push({
            length: cursor.len,
            pos: [cursor.x, cursor.y],
            latestSubvertIdx: currentSubvertIdx,
          })
          searchingIdx += 1

          if (searchingIdx > requests.length) return results
        }

        recentTailPos = {
          x: cursor.x,
          y: cursor.y,
          len: cursor.len,
        }
      } else if (currentCommand[0] === 'C') {
        const vertHeadPos = {
          x: indexedSubdivBeginState?.fragStartPos.x ?? recentTailPos.x,
          y: indexedSubdivBeginState?.fragStartPos.y ?? recentTailPos.y,
        }

        const recent = {
          x: vertHeadPos.x,
          y: vertHeadPos.y,
          len: recentTailPos.len,
        }

        for (var j = indexedSubdivBeginState?.div ?? 0; j <= SUBDIVIDES; j++) {
          var t = j / SUBDIVIDES
          var x = xof_C(vertHeadPos.x, currentCommand, t)
          var y = yof_C(vertHeadPos.y, currentCommand, t)
          cursor.len += distance(cursor.x, cursor.y, x, y)

          cursor.x = x
          cursor.y = y

          currentSubvertIdx++

          if (warm) {
            _lengthAtSubvert.push(cursor.len)

            _subvertIndex.push({
              pos: { x: cursor.x, y: cursor.y },

              div: j,
              svgVertIdx,
              prev: { ...recent },
              fragStartPos: { ...vertHeadPos },
            })
          }

          if (requests && cursor.len >= requests[searchingIdx]) {
            var dv =
              (cursor.len - requests[searchingIdx]) / (cursor.len - recent.len)

            var npos: [number, number] = [
              cursor.x * (1 - dv) + recent.x * dv,
              cursor.y * (1 - dv) + recent.y * dv,
            ]

            // returning
            results.push({
              length: cursor.len,
              pos: [npos[0], npos[1]],
              latestSubvertIdx: currentSubvertIdx,
            })

            searchingIdx += 1

            if (searchingIdx > requests.length) return results
          }

          recent.x = cursor.x
          recent.y = cursor.y
          recent.len = cursor.len
        }

        if (warm) {
          _lengthAtSVGVert.push(cursor.len)
        }

        recentTailPos = {
          x: cursor.x,
          y: cursor.y,
          len: cursor.len,
        }
      } else if (currentCommand[0] === 'Q') {
        const vertHeadPos = {
          x: indexedSubdivBeginState?.fragStartPos.x ?? recentTailPos.x,
          y: indexedSubdivBeginState?.fragStartPos.y ?? recentTailPos.y,
        }

        const recent = {
          x: vertHeadPos.x,
          y: vertHeadPos.y,
          len: cursor.len,
        }

        for (var j = indexedSubdivBeginState?.div ?? 0; j <= SUBDIVIDES; j++) {
          const t = j / SUBDIVIDES
          const x = xof_Q(vertHeadPos.x, currentCommand, t)
          const y = yof_Q(vertHeadPos.y, currentCommand, t)
          cursor.len += distance(cursor.x, cursor.y, x, y)

          cursor.x = x
          cursor.y = y

          currentSubvertIdx++
          if (warm) {
            _lengthAtSubvert.push(cursor.len)
            _subvertIndex.push({
              pos: { x: cursor.x, y: cursor.y },

              div: j,
              svgVertIdx: svgVertIdx,
              prev: { ...recent },
              fragStartPos: { ...vertHeadPos },
            })
          }

          if (requests && cursor.len >= requests[searchingIdx]) {
            var dv =
              (cursor.len - requests[searchingIdx]) / (cursor.len - recent.len)

            var npos: [number, number] = [
              cursor.x * (1 - dv) + recent.x * dv,
              cursor.y * (1 - dv) + recent.y * dv,
            ]

            // returning
            results.push({
              length: cursor.len,
              pos: [npos[0], npos[1]],
              latestSubvertIdx: currentSubvertIdx,
            })
            searchingIdx += 1

            if (searchingIdx > requests.length) return results
          }

          recent.x = cursor.x
          recent.y = cursor.y
          recent.len = cursor.len
        }

        if (warm) {
          _lengthAtSVGVert.push(cursor.len)
        }

        recentTailPos = {
          x: cursor.x,
          y: cursor.y,
          len: cursor.len,
        }
      } else if (currentCommand[0] === 'L') {
        const vertHeadPos = {
          x: indexedSubdivBeginState?.fragStartPos.x ?? recentTailPos.x,
          y: indexedSubdivBeginState?.fragStartPos.y ?? recentTailPos.y,
        }

        const recent = {
          x: vertHeadPos.x,
          y: vertHeadPos.y,
          len: recentTailPos.len,
        }

        for (var j = indexedSubdivBeginState?.div ?? 0; j <= SUBDIVIDES; j++) {
          var t = j / SUBDIVIDES
          var x = xof_L(vertHeadPos.x, currentCommand, t)
          var y = yof_L(vertHeadPos.y, currentCommand, t)
          cursor.len += distance(cursor.x, cursor.y, x, y)

          cursor.x = x
          cursor.y = y

          currentSubvertIdx++

          if (warm) {
            _lengthAtSubvert.push(cursor.len)
            _subvertIndex.push({
              pos: { x: cursor.x, y: cursor.y },

              div: j,
              svgVertIdx,
              prev: { ...recent },
              fragStartPos: { ...vertHeadPos },
            })
          }

          if (requests && cursor.len >= requests[searchingIdx]) {
            var dv =
              (cursor.len - requests[searchingIdx]) / (cursor.len - recent.len)
            dv = Number.isNaN(dv) || !Number.isFinite(dv) ? 0 : dv

            var npos: [number, number] = [
              cursor.x * (1 - dv) + recent.x * dv,
              cursor.y * (1 - dv) + recent.y * dv,
            ]

            // returning
            results.push({
              length: cursor.len,
              pos: [npos[0], npos[1]],
              latestSubvertIdx: currentSubvertIdx,
            })
            searchingIdx += 1

            if (searchingIdx > requests.length) return results
          }

          recent.x = cursor.x
          recent.y = cursor.y
          recent.len = cursor.len
        }

        if (warm) {
          _lengthAtSVGVert.push(cursor.len)
        }

        recentTailPos = {
          x: cursor.x,
          y: cursor.y,
          len: cursor.len,
        }
      }
    }

    if (warm || (requests && cursor.len >= requests[searchingIdx])) {
      results.push({
        length: cursor.len,
        pos: [cursor.x, cursor.y],
        latestSubvertIdx: currentSubvertIdx,
      })
    }

    return results

    function xof_C(startX: number, p: SVGDCommand, t: number) {
      const _ = 1 - t
      return (
        // prettier-ignore
        (_ * _ * _) * startX +
        3 * (_ * _) * t * p[1] +
        3 * _ * (t * t) * p[3] +
        (t * t * t) * p[5]
      )
    }

    function yof_C(startY: number, p: SVGDCommand, t: number) {
      const _ = 1 - t
      return (
        /* _pow ** 3 */
        // prettier-ignore
        (_ * _ * _) * startY +
        3 * (_ * _) * t * p[2] +
        3 * _ * (t * t) * p[4] +
        (t * t * t) * p[6]
      )
    }

    function xof_Q(startX: number, p: SVGDCommand, t: number) {
      const _ = 1 - t
      return (
        // prettier-ignore
        (_ * _) * startX +
        2 * _ * t * p[1] +
        (t * t) * p[3]
      )
    }

    function yof_Q(startY: number, p: SVGDCommand, t: number) {
      const _ = 1 - t
      return (
        // prettier-ignore
        (_ * _) * startY +
        2 * _ * t * p[2] +
        (t * t) * p[4]
      )
    }

    function xof_L(startX: number, p: SVGDCommand, t: number) {
      return startX + t * (p[1] - startX)
    }

    function yof_L(startY: number, p: SVGDCommand, t: number) {
      return startY + t * (p[2] - startY)
    }

    function distance(ax: number, ay: number, bx: number, by: number) {
      var x = ax - bx
      var y = ay - by

      // SEE: https://stackoverflow.com/a/19580786
      // return Math.pow(x * x + y * y, 0.5)
      return Math.sqrt(x * x + y * y)

      // https://stackoverflow.com/a/17410692
      // const xx = x * x + y * y
      // return (Math.cos(Math.asin((xx - 1) / (xx + 1))) * (xx + 1)) / 2
    }
  }
}

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

export class SequencialPointAtLength {
  public prevLen = -Infinity
  public nextHint: { latestSubvertIdx: number } | null = null

  constructor(protected pal: IndexedPointAtLength) {}

  public get totalLength() {
    return this.pal.totalLength
  }

  public at(len: number, { seek = true }: { seek?: boolean } = {}) {
    return this.atWithDetail(len, { seek }).pos
  }

  public atWithDetail(len: number, { seek = true }: { seek?: boolean } = {}) {
    if (len < this.prevLen) {
      throw new Error(
        'PointAtLength.sequencialReader.at: len must be larger than length of previous call',
      )
    }

    const result = this.pal.atWithDetail(len, {
      fromSubvertIndex: this.nextHint?.latestSubvertIdx,
    })

    if (seek) {
      this.nextHint = { latestSubvertIdx: result.latestSubvertIdx }
      this.prevLen = len
    }

    return result
  }
}

function normalizePath(path: string | SVGDCommand[]) {
  let norm = Array.isArray(path) ? path : parseSVGPath(path)
  norm = abs(norm)
  norm = zvhToL(norm)
  norm = longhand(norm)

  return norm
}

// SEE: https://stackoverflow.com/questions/60343999/binary-search-in-typescript-vs-indexof-how-to-get-performance-properly
function binarySearch(sortedArray: number[], seekElement: number): number {
  let left = 0
  let right = sortedArray.length - 1
  let minNearIdx = 0

  while (left <= right) {
    let mid = left + Math.floor((right - left) / 2)
    const guess = sortedArray[mid]

    if (guess === seekElement) {
      while (mid - 1 >= 0 && sortedArray[mid - 1] === seekElement) {
        mid--
      }

      return mid
    } else if (guess > seekElement) {
      right = minNearIdx = mid - 1
    } else {
      left = mid + 1
    }
  }

  return minNearIdx
}

if (import.meta.vitest) {
  describe('IndexedPointAtLength', () => {
    describe('binarySearch', () => {
      it('should return the index of the element', () => {
        expect(binarySearch([1.1, 2.2, 3.3, 4.4, 5.5], 3.3)).toBe(2)
      })

      it('should return the index of the nearest element', () => {
        expect(binarySearch([1.1, 2.2, 3.3, 4.4, 5.5], 3.5)).toBe(2)
      })

      it('should return the index of the nearest element', () => {
        expect(binarySearch([1.1, 2.2, 3.3, 4.4, 5.5], 2.5)).toBe(1)
      })

      it('should return the index of the early element when some value exists', () => {
        expect(binarySearch([1.1, 1.1, 1.1, 2.2, 3.3, 4.4, 5.5], 1.1)).toBe(0)
      })
    })
  })
}
