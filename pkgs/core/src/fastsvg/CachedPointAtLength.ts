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
  protected lengthIndexData: LengthIndexData[] = []

  /** array of point */
  protected vertIdxOfLengthIndex: number[] = []
  protected pointAtVertCache: {
    [indexOfLengthIndex: number]: [number, number]
  } = Object.create(null)

  constructor(path: string | Array<SVGDCommand>, protected divisions = 100) {
    this.points = point(path)._path

    // warming
    const warmResult = this.walk(null, divisions, { fromIndex: 0 }, true)
    this._length = warmResult.length
  }

  public get totalLength() {
    return this._length
  }

  public get _lengthCache() {
    return this.lengthCache
  }

  public get _lengthIndexData() {
    return this.lengthIndexData
  }

  public get _points() {
    return this.points
  }

  public at(
    len: number,
    {
      hintIndexGTEq,
      lengthIndex,
    }: { hintIndexGTEq?: number; lengthIndex?: number } = {}
  ) {
    return (
      (this.atWithDetail(len, { hintIndexGTEq, lengthIndex })?.pos as [
        number,
        number
      ]) ?? null
    )
  }

  public atWithDetail(
    len: number,
    {
      hintIndexGTEq,
      lengthIndex,
    }: { hintIndexGTEq?: number; lengthIndex?: number } = {}
  ) {
    if (hintIndexGTEq != null) {
      const result = this.walk(len, this.divisions, {
        fromIndex: hintIndexGTEq,
        lengthIndex,
      })
      return result
    }

    const lenIdx = binarySearch(this.lengthCache, len)
    const nearIdx = this.vertIdxOfLengthIndex[lenIdx]

    const result = this.walk(len, this.divisions, {
      fromIndex: nearIdx,
      // lengthIndex: lenIdx,
    })

    return result
  }

  public nearVertexAtLength(len: number) {
    const nearIndex =
      this.vertIdxOfLengthIndex[binarySearch(this.lengthCache, len)]

    return {
      index: nearIndex,
      length: this.lengthCache[nearIndex],
      pos: this.pointAtVertCache[nearIndex] as [x: number, y: number],
    }
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
    divs: number = this.divisions,
    {
      fromIndex = 0,
      lengthIndex = null,
    }: { fromIndex?: number; lengthIndex?: number | null } = {},
    warm: boolean | { warmFrom: number } = false
  ): {
    length: number
    pos: [number, number]
    lastIndex: number
    nextHint: LengthIndexData
  } {
    const {
      pointAtVertCache,
      lengthCache,
      vertIdxOfLengthIndex,
      lengthIndexData,
    } = this

    if (typeof warm !== 'boolean') {
      fromIndex = warm.warmFrom
    }

    var cur: [number, number] = [
      pointAtVertCache[fromIndex]?.[0] ?? 0,
      pointAtVertCache[fromIndex]?.[1] ?? 0,
    ]
    var len = lengthCache[fromIndex - 1] ?? 0
    let lenIdx = lengthIndex ?? 0

    var p0 = [0, 0, 0]
    var prev = [0, 0, 0]

    for (var i = fromIndex, l = this.points.length; i < l; i++) {
      var p = this.points[i]

      if (p[0] === 'M') {
        cur[0] = p[1]
        cur[1] = p[2]

        lenIdx++
        if (warm) {
          vertIdxOfLengthIndex.push(i)
          lengthCache.push(len)
          lengthIndexData.push({
            vertexIndex: i,
            lengthIndex: lenIdx,
            divFrom: 0,
          })
          pointAtVertCache[i] = [cur[0], cur[1]]
        }

        if (pos != null && (pos === 0 || pos < 0)) {
          return {
            length: len,
            pos: cur,
            lastIndex: i,
            nextHint: { vertexIndex: i, lengthIndex: lenIdx, divFrom: null },
          }
        }
      } else if (p[0] === 'C') {
        prev[0] = p0[0] = cur[0]
        prev[1] = p0[1] = cur[1]
        prev[2] = len

        lenIdx++
        if (warm) {
          pointAtVertCache[i] = [cur[0], cur[1]]
          vertIdxOfLengthIndex.push(i)
          lengthIndexData.push({
            vertexIndex: i,
            lengthIndex: lenIdx,
            divFrom: 0,
          })
          lengthCache.push(len)
        }

        const starthint = lengthIndex ? lengthIndexData[lengthIndex] : null
        let divStart = starthint?.vertexIndex === i ? starthint.divFrom ?? 0 : 0

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
              nextHint: { vertexIndex: i, lengthIndex: lenIdx, divFrom: j },
            }
          }

          // lenIdx++
          // if (warm) {
          //   pointIndexOfLengthIndex.push(i)
          //   lengthIndexData.push([i, lenIdx, j])
          //   lengthCache.push(len)
          // }

          prev[0] = cur[0]
          prev[1] = cur[1]
          prev[2] = len
        }
      } else if (p[0] === 'Q') {
        prev[0] = p0[0] = cur[0]
        prev[1] = p0[1] = cur[1]
        prev[2] = len

        lenIdx++
        if (warm) {
          pointAtVertCache[i] = [cur[0], cur[1]]
          vertIdxOfLengthIndex.push(i)
          lengthCache.push(len)
        }

        for (var j = 0; j <= divs; j++) {
          var t = j / divs
          var x = xof_Q(p, t)
          var y = yof_Q(p, t)
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

            lenIdx++
            if (warm) {
              pointAtVertCache[i] = [cur[0], cur[1]]
              vertIdxOfLengthIndex.push(i)
              lengthCache.push(len)
            }

            return {
              length: len,
              pos: npos,
              lastIndex: i,
              nextHint: { vertexIndex: i, lengthIndex: lenIdx, divFrom: j },
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

        lenIdx++
        if (warm) {
          pointAtVertCache[i] = [cur[0], cur[1]]
          vertIdxOfLengthIndex.push(i)
          lengthCache.push(len)
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
            nextHint: { vertexIndex: i, lengthIndex: lenIdx, divFrom: null },
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
      nextHint: { vertexIndex: i, lengthIndex: lenIdx, divFrom: null },
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
      hintIndexGTEq: this.nextHint?.vertexIndex,
      lengthIndex: this.nextHint?.lengthIndex,
    })

    if (seek) {
      this.nextHint = result.nextHint
      this.prevLen = len
    }
    return result.pos
  }
}

type LengthIndexData = {
  vertexIndex: number
  lengthIndex: number
  divFrom: number | null
}

// SEE: https://stackoverflow.com/questions/60343999/binary-search-in-typescript-vs-indexof-how-to-get-performance-properly
function binarySearch(sortedArray: number[], seekElement: number): number {
  let startIndex = 0
  let endIndex: number = sortedArray.length - 1
  let minNearIdx: number = 0

  while (startIndex <= endIndex) {
    const mid = startIndex + Math.floor((endIndex - startIndex) / 2)
    const guess = sortedArray[mid]
    if (guess === seekElement) {
      return mid
    } else if (guess > seekElement) {
      minNearIdx = endIndex = mid - 1
    } else {
      startIndex = mid + 1
    }
  }

  return minNearIdx!
}
