import { assign, deepClone } from '../utils'
import point from 'point-at-length'
import { mapPoints } from '../SilkHelpers'

class Path {
  // public start: { x: number; y: number } = { x: 0, y: 0 }
  public points: Path.PathPoint[] = []
  public closed: boolean = false
  private _pal: any

  public static create({
    // start,
    points,
    closed,
  }: {
    // start: Path.StartPoint
    points: Path.PathPoint[]
    closed: boolean
  }) {
    return assign(new Path(), {
      // start,
      points,
      closed,
    })
  }

  public static deserialize(obj: any) {
    return assign(new Path(), {
      // start: obj.start,
      points: obj.points,
      closed: obj.closed,
    })
  }

  protected constructor() {}

  public get svgPath() {
    return pointsToSVGPath(this.points, this.closed)
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
      // start: { ...this.start },
      points: [...this.points],
      closed: this.closed,
    }
  }

  private get pal() {
    return (this._pal ??= point(this.svgPath))
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
    weight?: number
  }
}

const pointsToSVGPath = (points: Path.PathPoint[], closed: boolean) => {
  const [start] = points

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
