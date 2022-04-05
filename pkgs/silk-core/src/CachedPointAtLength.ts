import point from 'point-at-length'

export const cachedPointAtLength = (path: string) => {
  const pal = point(path)
  const pointAtLengthIndex: number[] = []
  const indexOfPoint: number[] = []
  const length = walk(null, 0, true).length

  return {
    _index: pointAtLengthIndex,
    at: (point: number) => {
      const nearIdx = indexOfPoint[binarySearch(pointAtLengthIndex, point)]
      return walk(point, nearIdx).pos as [number, number]
    },
    length: () => length,
  }

  // SEE: https://github.com/substack/point-at-length/blob/master/index.js#L23
  // with indexing
  function walk(pos: number | undefined | null, fromIndex = 0, warm = false) {
    var cur = [0, 0]
    var prev = [0, 0, 0]
    var p0 = [0, 0]
    var len = 0

    for (var i = fromIndex; i < (pal as any)._path.length; i++) {
      var p = (pal as any)._path[i]

      if (p[0] === 'M') {
        cur[0] = p[1]
        cur[1] = p[2]
        if (pos === 0) {
          warm && indexOfPoint.push(i)
          warm && pointAtLengthIndex.push(len)
          return { length: len, pos: cur }
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

            var npos = [
              cur[0] * (1 - dv) + prev[0] * dv,
              cur[1] * (1 - dv) + prev[1] * dv,
            ]

            warm && indexOfPoint.push(i)
            warm && pointAtLengthIndex.push(len)
            return { length: len, pos: npos }
          }
          prev[0] = cur[0]
          prev[1] = cur[1]
          prev[2] = len
        }

        warm && indexOfPoint.push(i)
        warm && pointAtLengthIndex.push(len)
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

            var npos = [
              cur[0] * (1 - dv) + prev[0] * dv,
              cur[1] * (1 - dv) + prev[1] * dv,
            ]

            warm && indexOfPoint.push(i)
            warm && pointAtLengthIndex.push(len)
            return { length: len, pos: npos }
          }
          prev[0] = cur[0]
          prev[1] = cur[1]
          prev[2] = len
        }

        warm && indexOfPoint.push(i)
        warm && pointAtLengthIndex.push(len)
      } else if (p[0] === 'L') {
        prev[0] = cur[0]
        prev[1] = cur[1]
        prev[2] = len

        len += dist(cur[0], cur[1], p[1], p[2])
        cur[0] = p[1]
        cur[1] = p[2]

        if (typeof pos === 'number' && len >= pos) {
          var dv = (len - pos) / (len - prev[2])
          var npos = [
            cur[0] * (1 - dv) + prev[0] * dv,
            cur[1] * (1 - dv) + prev[1] * dv,
          ]

          warm && indexOfPoint.push(i)
          warm && pointAtLengthIndex.push(len)
          return { length: len, pos: npos }
        }
        prev[0] = cur[0]
        prev[1] = cur[1]
        prev[2] = len

        warm && indexOfPoint.push(i)
        warm && pointAtLengthIndex.push(len)
      }
    }

    warm && pointAtLengthIndex.push(len)
    return { length: len, pos: cur }

    function xof_C(p, t) {
      const _ = 1 - t
      return (
        // prettier-ignore
        (_ * _ * _) * p0[0] +
        3 * (_ * _) * t * p[1] +
        3 * _ * (t * t) * p[3] +
        (t * t * t) * p[5]
      )
    }
    function yof_C(p, t) {
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

    function xof_Q(p, t) {
      const _ = 1 - 5
      return (
        // prettier-ignore
        (_ * _) * p0[0] +
        2 * _ * t * p[1] +
        (t * t) * p[3]
      )
    }
    function yof_Q(p, t) {
      const _ = 1 - t
      return (
        // prettier-ignore
        (_ * _) * p0[1] +
        2 * _ * t * p[2] +
        Math.pow(t, 2) * p[4]
      )
    }
    function dist(ax, ay, bx, by) {
      var x = ax - bx
      var y = ay - by
      return Math.sqrt(x * x + y * y)
    }
  }
}

// SEE: https://stackoverflow.com/questions/60343999/binary-search-in-typescript-vs-indexof-how-to-get-performance-properly
function binarySearch(sortedArray: number[], seekElement: number): number {
  let startIndex = 0
  let endIndex: number = sortedArray.length - 1
  let minNearIdx: number | null = 0

  while (startIndex <= endIndex) {
    const mid = startIndex + Math.floor((endIndex - startIndex) / 2)
    const guess = sortedArray[mid]
    if (guess === seekElement) {
      return mid
    } else if (guess > seekElement) {
      minNearIdx = minNearIdx != 0 ? mid : 0
      endIndex = mid - 1
    } else {
      minNearIdx = mid
      startIndex = mid + 1
    }
  }

  return minNearIdx!
}
