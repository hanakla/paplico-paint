import point from 'point-at-length'

export type SVGDCommand = [cmd: string, ...args: number[]]

// This is fork of https://github.com/substack/point-at-length
// For faster point-at-length searching
export const indexedPointAtLength = (
  path: string | Array<SVGDCommand>,
  divisions = 100
) => {
  return new IndexedPointAtLength(path, divisions)
}

export class IndexedPointAtLength {
  public points: Array<SVGDCommand> = []
  protected _length: number = 0

  /** array of length at vertex */
  protected lengthCache: number[] = []
  protected lengthCacheDetail: {
    len: number
    div: number | null
    vertIdx: number
  }[] = []

  protected pointAtVertCache: {
    [indexOfLengthIndex: number]: [number, number]
  } = Object.create(null)

  constructor(
    path: string | Array<SVGDCommand>,
    protected readonly divisions = 100
  ) {
    this.points = point(path)._path

    // warming
    const warmResult = this.walk(null, { fromLengthIndex: 0 }, true)
    this.lengthCache.sort((a, b) => (a > b ? 1 : -1))
    this.lengthCacheDetail.sort((a, b) => (a.len > b.len ? 1 : -1))

    this._length = warmResult.length
  }

  public get totalLength() {
    return this._length
  }

  public get _lengthCache() {
    return this.lengthCache
  }

  public get _lengthCacheDetail() {
    return this.lengthCacheDetail
  }

  public get _points() {
    return this.points
  }

  public at(
    len: number,
    { fromLengthIndex }: { fromLengthIndex?: number } = {}
  ) {
    return this.atWithDetail(len, { fromLengthIndex })?.pos ?? null
  }

  public atWithDetail(
    len: number,
    { fromLengthIndex }: { fromLengthIndex?: number } = {}
  ) {
    if (fromLengthIndex != null) {
      const result = this.walk(len, {
        fromLengthIndex,
      })
      return result
    }

    const minNearIdx = binarySearch(this.lengthCache, len)

    const result = this.walk(len, {
      fromLengthIndex: minNearIdx,
    })

    console.log({
      reqLen: len,
      result,
      detail: this.lengthCacheDetail[minNearIdx],
    })

    return result
  }

  public lengthOfVertex(idx: number) {
    return {
      point: this.pointAtVertCache[idx] as [x: number, y: number],
      length: this.lengthCache[idx],
    }
  }

  public getSequencialReader() {
    return new SequencialPointAtLength(this)
  }

  // SEE: https://github.com/substack/point-at-length/blob/master/index.js#L23
  // with indexing
  private walk(
    pos: number | undefined | null,
    { fromLengthIndex = 0 }: { fromLengthIndex?: number } = {},
    warm: boolean = false
  ): {
    length: number
    pos: [number, number]
    lastIndex: number
    nextHint: LengthIndexData
  } {
    const divs = this.divisions
    const { pointAtVertCache, lengthCache, lengthCacheDetail } = this

    const fromVertIdx = warm
      ? 0
      : lengthCacheDetail[fromLengthIndex]?.vertIdx! ?? 0

    let cur: [number, number] = [
      pointAtVertCache[fromVertIdx]?.[0] ?? 0,
      pointAtVertCache[fromVertIdx]?.[1] ?? 0,
    ]

    let len = lengthCache[fromLengthIndex] ?? 0
    let currentLengthIndex = fromLengthIndex

    var p0 = [0, 0, 0]
    var prev = [0, 0, 0]

    for (var i = fromVertIdx, l = this.points.length; i < l; i++) {
      var p = this.points[i]

      if (p[0] === 'M') {
        cur[0] = p[1]
        cur[1] = p[2]

        currentLengthIndex++
        if (warm) {
          lengthCache.push(len)
          lengthCacheDetail.push({ len, div: null, vertIdx: i })
          pointAtVertCache[i] = [cur[0], cur[1]]
        }

        if (pos != null && (pos === 0 || pos < 0)) {
          return {
            length: len,
            pos: cur,
            lastIndex: i,
            nextHint: {
              lengthIndex: currentLengthIndex,
            },
          }
        }
      } else if (p[0] === 'C') {
        prev[0] = p0[0] = cur[0]
        prev[1] = p0[1] = cur[1]
        prev[2] = len

        currentLengthIndex++
        if (warm) {
          lengthCache.push(len)
          lengthCacheDetail.push({ len, div: null, vertIdx: i })
          pointAtVertCache[i] = [cur[0], cur[1]]
        }

        const divStart = lengthCacheDetail[fromLengthIndex]?.div ?? 0

        let j = divStart
        for (; j <= divs; j++) {
          var t = j / divs
          var x = xof_C(p, t)
          var y = yof_C(p, t)
          len += dist(cur[0], cur[1], x, y)

          cur[0] = x
          cur[1] = y

          if (typeof pos === 'number' && len >= pos) {
            var dv = (len - pos) / (len - prev[2])
            dv = Number.isNaN(dv) ? 0 : dv

            var npos = [
              cur[0] * (1 - dv) + prev[0] * dv,
              cur[1] * (1 - dv) + prev[1] * dv,
            ] as [number, number]

            return {
              length: len,
              pos: npos,
              lastIndex: i,
              nextHint: {
                lengthIndex: currentLengthIndex,
              },
            }
          }

          currentLengthIndex++
          if (warm) {
            lengthCache.push(len)
            lengthCacheDetail.push({ len, div: j, vertIdx: i })
            // skip, this is not a point
            // pointAtVertCache[i] = [cur[0], cur[1]]
          }

          prev[0] = cur[0]
          prev[1] = cur[1]
          prev[2] = len
        }
      } else if (p[0] === 'Q') {
        prev[0] = p0[0] = cur[0]
        prev[1] = p0[1] = cur[1]
        prev[2] = len

        currentLengthIndex++
        if (warm) {
          lengthCache.push(len)
          lengthCacheDetail.push({ len, div: null, vertIdx: i })
          pointAtVertCache[i] = [cur[0], cur[1]]
        }

        for (var j = 0; j <= divs; j++) {
          var t = j / divs
          var x = xof_Q(p, t)
          var y = yof_Q(p, t)
          len += dist(cur[0], cur[1], x, y)

          cur[0] = x
          cur[1] = y

          currentLengthIndex++
          if (warm) {
            lengthCache.push(len)
            lengthCacheDetail.push({ len, div: j, vertIdx: i })
            // skip, this is not a point
            // pointAtVertCache[i] = [cur[0], cur[1]]
          }

          if (typeof pos === 'number' && len >= pos) {
            var dv = (len - pos) / (len - prev[2])
            dv = Number.isNaN(dv) ? 0 : dv

            var npos = [
              cur[0] * (1 - dv) + prev[0] * dv,
              cur[1] * (1 - dv) + prev[1] * dv,
            ] as [number, number]

            return {
              length: len,
              pos: npos,
              lastIndex: i,
              nextHint: {
                lengthIndex: currentLengthIndex,
              },
            }
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
          pointAtVertCache[i] = [cur[0], cur[1]]
        }

        if (typeof pos === 'number' && len >= pos) {
          var dv = (len - pos) / (len - prev[2])
          dv = Number.isNaN(dv) ? 0 : dv

          var npos = [
            cur[0] * (1 - dv) + prev[0] * dv,
            cur[1] * (1 - dv) + prev[1] * dv,
          ] as [number, number]

          return {
            length: len,
            pos: npos,
            lastIndex: i,
            nextHint: {
              lengthIndex: currentLengthIndex,
            },
          }
        }

        prev[0] = cur[0]
        prev[1] = cur[1]
        prev[2] = len
      }
    }

    // warm && pointIndexOfLengthIndex.push(i)
    // warm && lengthCache.push(len)

    return {
      length: len,
      pos: cur,
      nextHint: {
        lengthIndex: currentLengthIndex,
      },
      lastIndex: i,
    }

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

export class SequencialPointAtLength {
  public prevLen = -Infinity
  public nextHint: LengthIndexData | null = null

  constructor(protected pal: IndexedPointAtLength) {}

  get _cache() {
    return this.pal._lengthCache
  }

  get totalLength() {
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

type LengthIndexData = {
  lengthIndex: number
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
