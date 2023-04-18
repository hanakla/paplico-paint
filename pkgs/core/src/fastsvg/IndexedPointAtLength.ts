/*
This is fork of https://github.com/substack/point-at-length
For faster point-at-length searching
*/

import { parseSVGPath } from './parse'
import abs from 'abs-svg-path'

export type SVGDCommand = [cmd: string, ...args: number[]]

export const indexedPointAtLength = (path: string | Array<SVGDCommand>) => {
  return new IndexedPointAtLength(path)
}

export class IndexedPointAtLength {
  protected _path: Array<SVGDCommand>
  protected _length: number = 0

  protected lengthCache: number[] = []
  protected lengthCacheDetail: {
    len: number
    div: number | null
    vertIdx: number
  }[] = []

  constructor(path: string | Array<SVGDCommand>) {
    this._path = Array.isArray(path) ? path : parseSVGPath(path)
    this._path = abs(this._path)
    this._path = zvhToL(this._path)
    this._path = longhand(this._path)

    const warm = this._walk(null, { warm: true })
    this._length = warm.length
  }

  public get _lengthCache() {
    return this.lengthCache
  }

  public get _lengthCacheDetail() {
    return this.lengthCacheDetail
  }

  public get totalLength() {
    return this._length
  }

  public at(
    pos: number,
    opts: {
      fromLengthIndex?: number
    } = {}
  ) {
    return this._walk(pos, opts).pos
  }

  public atWithDetail(
    pos: number,
    opts: {
      fromLengthIndex?: number
    } = {}
  ) {
    return this._walk(pos, opts)
  }

  public getSequencialReader() {
    return new SequencialPointAtLength(this)
  }

  protected _walk(
    pos: number | null,
    {
      warm,
      fromLengthIndex = 0,
    }: {
      warm?: boolean
      fromLengthIndex?: number
    } = {}
  ): {
    length: number
    pos: [number, number]
    latestLenIdx: number
  } {
    const { lengthCache, lengthCacheDetail } = this

    let cur: [number, number] = [0, 0]
    let prev: [number, number, number] = [0, 0, 0]
    let p0: [number, number] = [0, 0]
    let len = 0

    const fromVertIndex = warm
      ? 0
      : lengthCacheDetail[fromLengthIndex]?.vertIdx ?? 0
    let currentLengthIndex = 0

    for (let i = fromVertIndex; i < this._path.length; i++) {
      var p = this._path[i]

      if (p[0] === 'M') {
        cur[0] = p[1]
        cur[1] = p[2]

        currentLengthIndex++
        if (warm) {
          lengthCache.push(len)
          lengthCacheDetail.push({ len, div: null, vertIdx: i })
        }

        if (pos === 0) {
          return { length: len, pos: cur, latestLenIdx: currentLengthIndex }
        }
      } else if (p[0] === 'C') {
        prev[0] = p0[0] = cur[0]
        prev[1] = p0[1] = cur[1]
        prev[2] = len

        var n = 100
        for (var j = 0; j <= n; j++) {
          var t = j / n
          var x = xof_C(p, t)
          var y = yof_C(p, t)
          len += dist(cur[0], cur[1], x, y)

          cur[0] = x
          cur[1] = y

          if (typeof pos === 'number' && len >= pos) {
            var dv = (len - pos) / (len - prev[2])

            var npos: [number, number] = [
              cur[0] * (1 - dv) + prev[0] * dv,
              cur[1] * (1 - dv) + prev[1] * dv,
            ]
            return { length: len, pos: npos, latestLenIdx: currentLengthIndex }
          }

          currentLengthIndex++
          if (warm) {
            lengthCache.push(len)
            lengthCacheDetail.push({ len, div: j, vertIdx: i })
          }

          prev[0] = cur[0]
          prev[1] = cur[1]
          prev[2] = len
        }
      } else if (p[0] === 'Q') {
        prev[0] = p0[0] = cur[0]
        prev[1] = p0[1] = cur[1]
        prev[2] = len

        var n = 100
        for (var j = 0; j <= n; j++) {
          var t = j / n
          var x = xof_Q(p, t)
          var y = yof_Q(p, t)
          len += dist(cur[0], cur[1], x, y)

          cur[0] = x
          cur[1] = y

          if (typeof pos === 'number' && len >= pos) {
            var dv = (len - pos) / (len - prev[2])

            var npos: [number, number] = [
              cur[0] * (1 - dv) + prev[0] * dv,
              cur[1] * (1 - dv) + prev[1] * dv,
            ]
            return { length: len, pos: npos, latestLenIdx: currentLengthIndex }
          }

          currentLengthIndex++
          if (warm) {
            lengthCache.push(len)
            lengthCacheDetail.push({ len, div: j, vertIdx: i })
          }

          prev[0] = cur[0]
          prev[1] = cur[1]
          prev[2] = len
        }
      } else if (p[0] === 'L') {
        prev[0] = cur[0]
        prev[1] = cur[1]
        prev[2] = len

        len += dist(cur[0], cur[1], p[1], p[2])
        cur[0] = p[1]
        cur[1] = p[2]

        currentLengthIndex++
        if (warm) {
          lengthCache.push(len)
          lengthCacheDetail.push({ len, div: null, vertIdx: i })
        }

        if (typeof pos === 'number' && len >= pos) {
          var dv = (len - pos) / (len - prev[2])
          var npos: [number, number] = [
            cur[0] * (1 - dv) + prev[0] * dv,
            cur[1] * (1 - dv) + prev[1] * dv,
          ]
          return { length: len, pos: npos, latestLenIdx: currentLengthIndex }
        }

        prev[0] = cur[0]
        prev[1] = cur[1]
        prev[2] = len
      }
    }

    return { length: len, pos: cur, latestLenIdx: currentLengthIndex }

    function xof_C(p: SVGDCommand, t: number) {
      const _ = 1 - t
      return (
        // prettier-ignore
        (_ * _ * _) * p0[0] +
        3 * (_ * _) * t * p[1] +
        3 * _ * (t * t) * p[3] +
        (t * t * t) * p[5]
      )
    }

    function yof_C(p: SVGDCommand, t: number) {
      const _ = 1 - t
      return (
        /* _pow ** 3 */
        // prettier-ignore
        (_ * _ * _) * p0[1] +
        3 * (_ * _)  * t * p[2] +
        3 * _ * (t * t) * p[4] +
        (t * t * t) * p[6]
      )
    }

    function xof_Q(p: SVGDCommand, t: number) {
      const _ = 1 - t
      return (
        // prettier-ignore
        (_ * _) * p0[0] +
        2 * _ * t * p[1] +
        (t * t) * p[3]
      )
    }

    function yof_Q(p: SVGDCommand, t: number) {
      const _ = 1 - t
      return (
        // prettier-ignore
        (_ * _) * p0[1] +
        2 * _ * t * p[2] +
        (t * t) * p[4]
      )
    }

    function dist(ax: number, ay: number, bx: number, by: number) {
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
  public nextHint: { latestLenIdx: number } | null = null

  constructor(protected pal: IndexedPointAtLength) {}

  public get totalLength() {
    return this.pal.totalLength
  }

  public at(len: number, { seek = true }: { seek?: boolean } = {}) {
    if (len < this.prevLen) {
      throw new Error(
        'PointAtLength.sequencialReader.at: len must be larger than length of previous call'
      )
    }

    const result = this.pal.atWithDetail(len, {
      fromLengthIndex: this.nextHint?.lengthIndex,
    })

    if (seek) {
      this.nextHint = result.nextHint
      this.prevLen = len
    }
    return result.pos
  }
}

// SEE: https://stackoverflow.com/questions/60343999/binary-search-in-typescript-vs-indexof-how-to-get-performance-properly
function binarySearch(sortedArray: number[], seekElement: number): number {
  let left = 0
  let right = sortedArray.length - 1
  let minNearIdx = 0

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2)
    const guess = sortedArray[mid]

    if (guess === seekElement) {
      return mid
    } else if (guess > seekElement) {
      minNearIdx = right = mid - 1
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
        expect(binarySearch([1, 2, 3, 4, 5], 3)).toBe(2)
      })

      it('should return the index of the nearest element', () => {
        expect(binarySearch([1, 2, 3, 4, 5], 3.5)).toBe(3)
      })

      it('should return the index of the nearest element', () => {
        expect(binarySearch([1, 2, 3, 4, 5], 2.5)).toBe(1)
      })
    })
  })
}
