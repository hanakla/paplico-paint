import point from 'point-at-length'

// This is fork of https://github.com/substack/point-at-length
// For faster point-at-length searching
export const cachedPointAtLength = (path: string, divisions = 100) => {
  const pal = point(path)

  const points = (pal as any)._path as [number, number][]
  const lengthCache: number[] =
    [] /** array of length, array index points to points */
  const lengthIndexData: LengthIndexData[] = []

  const vertPtCache: { [indexOfLengthIndex: number]: [number, number] } =
    Object.create(null) /** array of point */
  const vertIdxOfLengthIndex: number[] = []

  // Make index with 10 divisions (keep faster for binary search)
  const warmResult = walk(null, divisions, { fromIndex: 0 }, true)
  const length = warmResult!.length

  const atGetter = {
    get _lengthCache() {
      return lengthCache
    },
    get _lengthIndexData() {
      return lengthIndexData
    },
    get _points() {
      return points
    },

    at: (len: number, { hintIndexGTEq }: { hintIndexGTEq?: number } = {}) => {
      return (
        (atGetter.atWithDetail(len, { hintIndexGTEq })?.pos as [
          number,
          number
        ]) ?? null
      )
    },
    atWithDetail: (
      len: number,
      { hintIndexGTEq }: { hintIndexGTEq?: number } = {}
    ) => {
      if (hintIndexGTEq != null) {
        const result = walk(len, divisions, { fromIndex: hintIndexGTEq })
        return result
      }

      const nearIdx = vertIdxOfLengthIndex[binarySearch(lengthCache, len)]
      const result = walk(len, divisions, { fromIndex: nearIdx })

      return result
    },
    nearVertexAtLength: (len: number) => {
      const nearIndex = vertIdxOfLengthIndex[binarySearch(lengthCache, len)]

      return {
        index: nearIndex,
        length: lengthCache[nearIndex],
        pos: points[nearIndex] as [x: number, y: number],
      }
    },
    lengthOfVertex: (idx: number) => {
      return {
        point: points[idx] as [x: number, y: number],
        length: lengthCache[idx],
      }
    },
    getSequencialReader: () => {
      let prevLen = -Infinity
      let nextHint: LengthIndexData | null = null

      const reader = {
        at(len: number, { seek = true }: { seek?: boolean } = {}) {
          return reader.atWithDetail(len, { seek }).pos as [number, number]
        },
        atWithDetail(len: number, { seek = true }: { seek?: boolean } = {}) {
          if (len < prevLen)
            throw new Error(
              'PointAtLength.sequencialReader.at: len must be larger than length of previous call'
            )

          // TODO: fastify with index hint
          const nearIdx = vertIdxOfLengthIndex[binarySearch(lengthCache, len)]
          return atGetter.atWithDetail(len, {
            hintIndexGTEq: nearIdx,
          })
          // const result = walk(len, divisions, {
          //   fromIndex: nextHint?.[0] ?? 0,
          //   // lengthIndex: nextHint?.[1] ?? 0,
          // })

          // if (seek) nextHint = result.nextHint!

          // return result
        },
      }

      return reader
    },
    length: () => length,
  }

  return atGetter

  // SEE: https://github.com/substack/point-at-length/blob/master/index.js#L23
  // with indexing
  function walk(
    pos: number | undefined | null,
    divs: number = divisions,
    {
      fromIndex,
      lengthIndex,
    }: { fromIndex?: number; lengthIndex?: number | null } = {
      fromIndex: 0,
      lengthIndex: null,
    },
    warm = false
  ): {
    length: number
    pos: [number, number]
    lastIndex: number
    nextHint: LengthIndexData
  } {
    fromIndex ??= 0

    var cur: [number, number] = [
      vertPtCache[fromIndex]?.[0] ?? 0,
      vertPtCache[fromIndex]?.[1] ?? 0,
    ]
    var len = lengthCache[fromIndex - 1] ?? 0
    let lenIdx = lengthIndex ?? 0

    var p0 = [0, 0, 0]
    var prev = [0, 0, 0]

    for (var i = fromIndex, l = (pal as any)._path.length; i < l; i++) {
      var p = (pal as any)._path[i]

      if (p[0] === 'M') {
        cur[0] = p[1]
        cur[1] = p[2]

        lenIdx++
        if (warm) {
          vertIdxOfLengthIndex.push(i)
          lengthCache.push(len)
          lengthIndexData.push([i, lenIdx, 0])
          vertPtCache[i] = [cur[0], cur[1]]
        }

        if (pos != null && (pos === 0 || pos < 0)) {
          return {
            length: len,
            pos: cur,
            lastIndex: i,
            nextHint: [i, lenIdx, null],
          }
        }
      } else if (p[0] === 'C') {
        prev[0] = p0[0] = cur[0]
        prev[1] = p0[1] = cur[1]
        prev[2] = len

        lenIdx++
        if (warm) {
          vertPtCache[i] = [cur[0], cur[1]]
          vertIdxOfLengthIndex.push(i)
          lengthIndexData.push([i, lenIdx, 0])
          lengthCache.push(len)
        }

        const starthint = lengthIndex ? lengthIndexData[lengthIndex] : null
        let divStart = starthint && starthint[0] === i ? starthint[1] : 0

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
              nextHint: [i, lenIdx, j],
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
          vertPtCache[i] = [cur[0], cur[1]]
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
              vertPtCache[i] = [cur[0], cur[1]]
              vertIdxOfLengthIndex.push(i)
              lengthCache.push(len)
            }

            return {
              length: len,
              pos: npos,
              lastIndex: i,
              nextHint: [i, lenIdx, j],
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
          vertPtCache[i] = [cur[0], cur[1]]
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
            nextHint: [i, lenIdx, null],
          }
        }

        prev[0] = cur[0]
        prev[1] = cur[1]
        prev[2] = len
      }
    }

    // warm && pointIndexOfLengthIndex.push(i)
    // warm && lengthCache.push(len)

    return { length: len, pos: cur, nextHint: [i, lenIdx, null], lastIndex: i }

    function xof_C(p: number[], t: number) {
      const _ = 1 - t
      return (
        // prettier-ignore
        (_ * _ * _) * p0[0] +
        3 * (_ * _) * t * p[1] +
        3 * _ * (t * t) * p[3] +
        (t * t * t) * p[5]
      )
    }

    function yof_C(p: number[], t: number) {
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

    function xof_Q(p: number[], t: number) {
      const _ = 1 - t
      return (
        // prettier-ignore
        (_ * _) * p0[0] +
        2 * _ * t * p[1] +
        (t * t) * p[3]
      )
    }

    function yof_Q(p: number[], t: number) {
      const _ = 1 - t
      return (
        // prettier-ignore
        (_ * _) * p0[1] +
        2 * _ * t * p[2] +
        Math.pow(t, 2) * p[4]
      )
    }

    function dist(ax: number, ay: number, bx: number, by: number) {
      var x = ax - bx
      var y = ay - by
      return Math.sqrt(x * x + y * y)
    }
  }
}

export type LengthIndexData = [
  vertexIndex: number,
  lengthIndex: number,
  divFrom: number | null
]

export type CachedPointAtLength = ReturnType<typeof cachedPointAtLength>

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
