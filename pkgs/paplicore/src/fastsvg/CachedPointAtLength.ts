import point from 'point-at-length'

// This is fork of https://github.com/substack/point-at-length
// For faster point-at-length searching
export const cachedPointAtLength = (path: string) => {
  const pal = point(path)

  const points = (pal as any)._path as [number, number][]
  const lengthCache: number[] =
    [] /** array of length, array index points to points */
  const pointsCache: { [indexOfLengthIndex: number]: [number, number] } =
    Object.create(null) /** array of point */
  const pointIndexOfLengthIndex: number[] = []

  const warmResult = walk(null, 0, true)
  const length = warmResult.length

  const atGetter = {
    _index: lengthCache,
    _points: points,
    at: (len: number, { hintIndexGTEq }: { hintIndexGTEq?: number } = {}) => {
      return atGetter.atWithDetail(len, { hintIndexGTEq }).pos as [
        number,
        number
      ]
    },
    atWithDetail: (
      len: number,
      { hintIndexGTEq }: { hintIndexGTEq?: number } = {}
    ) => {
      if (hintIndexGTEq != null) {
        let a = walk(len, hintIndexGTEq)
        return a
      }

      const nearIdx = pointIndexOfLengthIndex[binarySearch(lengthCache, len)]
      return walk(len, nearIdx)
    },
    nearPointAtLength: (len: number) => {
      const nearIndex = pointIndexOfLengthIndex[binarySearch(lengthCache, len)]

      return {
        index: nearIndex,
        length: lengthCache[nearIndex],
        pos: points[nearIndex] as [x: number, y: number],
      }
    },
    lengthOfPoint: (idx: number) => {
      return {
        point: points[idx] as [x: number, y: number],
        length: lengthCache[idx],
      }
    },
    length: () => length,
  }

  return atGetter

  // SEE: https://github.com/substack/point-at-length/blob/master/index.js#L23
  // with indexing
  function walk(pos: number | undefined | null, fromIndex = 0, warm = false) {
    var cur = [
      pointsCache[fromIndex]?.[0] ?? 0,
      pointsCache[fromIndex]?.[1] ?? 0,
    ]
    var len = lengthCache[fromIndex] ?? 0

    var prev = [0, 0, 0]
    var p0 = [0, 0]

    for (var i = fromIndex, l = (pal as any)._path.length; i < l; i++) {
      var p = (pal as any)._path[i]

      if (p[0] === 'M') {
        cur[0] = p[1]
        cur[1] = p[2]

        warm && pointIndexOfLengthIndex.push(i)
        warm && lengthCache.push(len)
        warm && (pointsCache[i] = [cur[0], cur[1]])

        if (pos === 0) {
          return { length: len, pos: cur, lastIndex: i }
        }
      } else if (p[0] === 'C') {
        prev[0] = p0[0] = cur[0]
        prev[1] = p0[1] = cur[1]
        prev[2] = len

        warm && pointIndexOfLengthIndex.push(i)
        warm && lengthCache.push(len)
        warm && (pointsCache[i] = [cur[0], cur[1]])

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
            dv = Number.isNaN(dv) ? 0 : dv

            var npos = [
              cur[0] * (1 - dv) + prev[0] * dv,
              cur[1] * (1 - dv) + prev[1] * dv,
            ]

            return { length: len, pos: npos, lastIndex: i }
          }

          prev[0] = cur[0]
          prev[1] = cur[1]
          prev[2] = len
        }
      } else if (p[0] === 'Q') {
        prev[0] = p0[0] = cur[0]
        prev[1] = p0[1] = cur[1]
        prev[2] = len

        warm && (pointsCache[i] = [cur[0], cur[1]])
        warm && pointIndexOfLengthIndex.push(i)
        warm && lengthCache.push(len)

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

            var npos = [
              cur[0] * (1 - dv) + prev[0] * dv,
              cur[1] * (1 - dv) + prev[1] * dv,
            ]

            return { length: len, pos: npos, lastIndex: i }
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

        warm && (pointsCache[i] = [cur[0], cur[1]])
        warm && pointIndexOfLengthIndex.push(i)
        warm && lengthCache.push(len)

        if (typeof pos === 'number' && len >= pos) {
          var dv = (len - pos) / (len - prev[2])
          var npos = [
            cur[0] * (1 - dv) + prev[0] * dv,
            cur[1] * (1 - dv) + prev[1] * dv,
          ]

          return { length: len, pos: npos, lastIndex: i }
        }
        prev[0] = cur[0]
        prev[1] = cur[1]
        prev[2] = len
      }
    }

    warm && lengthCache.push(len)

    return { length: len, pos: cur, lastIndex: i }

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
