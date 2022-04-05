import bounds from 'svg-path-bounds'

import { assign, deepClone } from '../utils'
import { mapPoints } from '../SilkHelpers'
import { cachedPointAtLength } from '../CachedPointAtLength'

class Path {
  public points: Path.PathPoint[] = []
  public closed: boolean = false
  private _pal: any

  public static create({
    points,
    closed,
  }: {
    points: Path.PathPoint[]
    closed: boolean
  }) {
    return assign(new Path(), {
      points,
      closed,
    })
  }

  public static deserialize(obj: any) {
    return assign(new Path(), {
      points: obj.points,
      closed: obj.closed,
    })
  }

  protected constructor() {}

  public get svgPath() {
    return pointsToSVGPath(this.points, this.closed)
  }

  public getBoundingBox() {
    const [left, top, right, bottom] = bounds(this.svgPath)
    const width = Math.abs(right - left)
    const height = Math.abs(bottom - right)

    return {
      left,
      top,
      right,
      bottom,
      centerX: left + width / 2,
      centerY: top + height / 2,
      width,
      height,
    }
  }

  // public updatePoints(
  //   process: (current: {
  //     start: Path.StartPoint
  //     points: Path.PathPoint[]
  //   }) => { start: Path.StartPoint; points: Path.PathPoint[] }
  // ) {
  //   const { start, points } = process({
  //     start: this.start,
  //     points: this.points,
  //   })

  //   this.start = start
  //   this.points = points
  // }

  public getTotalLength() {
    return this.pal.length()
  }

  public getPointAtLength(pos: number): { x: number; y: number } {
    const [x, y] = this.pal.at(pos)
    return { x, y }
  }

  // TODO: 誰か実装してくれ
  // public segmentIndexAtPoint(x: number, y: number) {
  //   const segs = this.points.reverse()

  //   for (let idx = 0; idx < segs.length; idx++) {
  //     const current = segs[idx]
  //     const prev = segs[idx + 1]

  //     if (current.)
  //   }
  // }

  public mapPoints<T>(
    proc: (
      point: Path.PathPoint,
      prevPoint: Path.PathPoint | undefined,
      idx: number,
      points: Path.PathPoint[]
    ) => T,
    option: { startOffset?: number } = { startOffset: 0 }
  ): T[] {
    const [start] = this.points
    const points: Path.PathPoint[] = this.closed
      ? [...this.points, start]
      : this.points

    return mapPoints(points, proc, option)
  }

  public clone() {
    return Path.create({ points: deepClone(this.points), closed: this.closed })
  }

  public serialize() {
    return {
      points: deepClone(this.points),
      closed: this.closed,
    }
  }

  private get pal() {
    return (this._pal ??= cachedPointAtLength(this.svgPath))
  }
}

namespace Path {
  export type StartPoint = { x: number; y: number }

  export type PathPoint = {
    in: { x: number; y: number } | null
    out: { x: number; y: number } | null
    // c1x: number
    // c1y: number
    // c2x: number
    // c2y: number
    x: number
    y: number
    /** 0 to 1 */
    pressure?: number
  }
}

const pointsToSVGPath = (points: Path.PathPoint[], closed: boolean) => {
  const [start] = points

  if (points.length === 1) {
    return `M${start.x},${start.y}`
  }

  return [
    `M${start.x},${start.y}`,
    mapPoints(
      points,
      (point, prev) => {
        if (prev!.out && point.in) {
          return `C ${prev!.out.x},${prev!.out.y} ${point.in.x},${point.in.y} ${
            point.x
          } ${point.y}`
        } else if (prev!.out == null && point.in) {
          return `C ${prev!.x},${prev!.y} ${point.in.x},${point.in.y} ${
            point.x
          } ${point.y}`
        } else if (prev!.out && point.in == null) {
          return `C ${prev!.out.x},${prev!.out.y} ${point.x},${point.y} ${
            point.x
          } ${point.y}`
        } else {
          return `L ${prev!.x},${prev!.y} ${point.x} ${point.y}`
        }
      },
      { startOffset: 1 }
    ).join(' '),
    closed ? 'Z' : '',
  ].join(' ')
}

export { Path }
