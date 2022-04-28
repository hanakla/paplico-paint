/*!
  Copyright (c) 2013 Dima Yv <df.creative@gmail.com>
  Licensed under the MIT License (MIT), see https://github.com/dy/svg-path-bounds

  Original from https://github.com/dy/svg-path-bounds/blob/master/index.js
  Fork for faster
*/

import { parseSVGPath } from './parse'
import arcToCurve from 'svg-arc-to-cubic-bezier'

export function pathBounds(path: string) {
  // if (!isSvgPath(path)) throw Error('String is not an SVG path.')

  let parsed = parseSVGPath(path)

  if (!parsed.length) return [0, 0, 0, 0]

  const bounds = [Infinity, Infinity, -Infinity, -Infinity]

  let abs_startX = 0
  let abs_startY = 0
  let abs_x = 0
  let abs_y = 0

  let norm_prev
  let norm_result = []
  let norm_bezierX = 0
  let norm_bezierY = 0
  let norm_startX = 0
  let norm_startY = 0
  let norm_quadX: number | null = null
  let norm_quadY: number | null = null
  let norm_x = 0
  let norm_y = 0

  for (let vert of parsed) {
    // absolutelize
    // Licensed under the MIT License (MIT), see https://github.com/jkroso/abs-svg-path/blob/master/License
    // Copyright (c) 2013 Jake Rosoman <jkroso@gmail.com>
    // original: https://github.com/jkroso/abs-svg-path/blob/master/index.js
    {
      const seg = vert
      const type = seg[0]
      const command = type.toUpperCase()

      // is relative
      if (type != command) {
        seg[0] = command
        switch (type) {
          case 'a':
            seg[6] += abs_x
            seg[7] += abs_y
            break
          case 'v':
            seg[1] += abs_y
            break
          case 'h':
            seg[1] += abs_x
            break
          default:
            for (let i = 1, l = seg.length; i < l; ) {
              ;(seg[i++] as number) += abs_x
              ;(seg[i++] as number) += abs_y
            }
        }
      }

      // update cursor state
      switch (command) {
        case 'Z':
          abs_x = abs_startX
          abs_y = abs_startY
          break
        case 'H':
          abs_x = seg[1]
          break
        case 'V':
          abs_y = seg[1]
          break
        case 'M':
          abs_x = abs_startX = seg[1]
          abs_y = abs_startY = seg[2]
          break
        default:
          abs_x = seg[seg.length - 2] as number
          abs_y = seg[seg.length - 1] as number
      }

      vert = seg
    }

    // normalize
    //
    // Licensed under the MIT License (MIT), see https://github.com/jkroso/normalize-svg-path/blob/master/license.md
    // Copyright © 2008-2013 Dmitry Baranovskiy (http://raphaeljs.com)
    // Copyright © 2008-2013 Sencha Labs (http://sencha.com)
    // Copyright © 2013 Jake Rosoman jkroso@gmail.com
    // original: https://github.com/jkroso/normalize-svg-path/blob/master/index.js
    {
      var seg = vert
      var command = seg[0]

      switch (command) {
        case 'M':
          norm_startX = seg[1]
          norm_startY = seg[2]
          break
        case 'A':
          var curves = arcToCurve({
            px: norm_x,
            py: norm_y,
            cx: seg[6],
            cy: seg[7],
            rx: seg[1],
            ry: seg[2],
            xAxisRotation: seg[3],
            largeArcFlag: seg[4] as 0 | 1,
            sweepFlag: seg[5] as 0 | 1,
          })

          // null-curves
          if (!curves.length) continue

          for (var j = 0, c; j < curves.length; j++) {
            c = curves[j]
            seg = ['C', c.x1, c.y1, c.x2, c.y2, c.x, c.y]
            if (j < curves.length - 1) norm_result.push(seg)
          }

          break
        case 'S':
          // default control point
          var cx = norm_x
          var cy = norm_y
          if (norm_prev == 'C' || norm_prev == 'S') {
            cx += cx - norm_bezierX // reflect the previous command's control
            cy += cy - norm_bezierY // point relative to the current point
          }
          seg = ['C', cx, cy, seg[1], seg[2], seg[3], seg[4]]
          break
        case 'T':
          if (norm_prev == 'Q' || norm_prev == 'T') {
            norm_quadX = norm_x * 2 - norm_quadX! // as with 'S' reflect previous control point
            norm_quadY = norm_y * 2 - norm_quadY!
          } else {
            norm_quadX = norm_x
            norm_quadY = norm_y
          }
          seg = norm_quadratic(
            norm_x,
            norm_y,
            norm_quadX,
            norm_quadY,
            seg[1],
            seg[2]
          )
          break
        case 'Q':
          norm_quadX = seg[1]
          norm_quadY = seg[2]
          seg = norm_quadratic(norm_x, norm_y, seg[1], seg[2], seg[3], seg[4])
          break
        case 'L':
          seg = norm_line(norm_x, norm_y, seg[1], seg[2])
          break
        case 'H':
          seg = norm_line(norm_x, norm_y, seg[1], norm_y)
          break
        case 'V':
          seg = norm_line(norm_x, norm_y, norm_x, seg[1])
          break
        case 'Z':
          seg = norm_line(norm_x, norm_y, norm_startX, norm_startY)
          break
      }

      // update state
      norm_prev = command
      norm_x = seg[seg.length - 2] as number
      norm_y = seg[seg.length - 1] as number
      if (seg.length > 4) {
        norm_bezierX = seg[seg.length - 4] as number
        norm_bezierY = seg[seg.length - 3] as number
      } else {
        norm_bezierX = norm_x
        norm_bezierY = norm_y
      }

      vert = seg
    }

    let points: number[] = vert.slice(1) as number[]

    for (let j = 0, l = points.length; j < l; j += 2) {
      if (points[j + 0] < bounds[0]) bounds[0] = points[j + 0]
      if (points[j + 1] < bounds[1]) bounds[1] = points[j + 1]
      if (points[j + 0] > bounds[2]) bounds[2] = points[j + 0]
      if (points[j + 1] > bounds[3]) bounds[3] = points[j + 1]
    }
  }

  return bounds
}

function norm_line(x1: number, y1: number, x2: number, y2: number) {
  return ['C', x1, y1, x2, y2, x2, y2] as [string, ...number[]]
}

function norm_quadratic(
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number
) {
  return [
    'C',
    x1 / 3 + (2 / 3) * cx,
    y1 / 3 + (2 / 3) * cy,
    x2 / 3 + (2 / 3) * cx,
    y2 / 3 + (2 / 3) * cy,
    x2,
    y2,
  ] as [string, ...number[]]
}
