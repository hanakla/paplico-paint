import { assign } from '../utils'
import point from 'point-at-length'

class Path {
  public start: { x: number; y: number } = { x: 0, y: 0 }
  public points: Path.PathPoint[] = []
  public closed: boolean = false
  private _pal: any

  public static create({
    start,
    points,
    closed,
  }: {
    start: Path.StartPoint
    points: Path.PathPoint[]
    closed: boolean
  }) {
    return assign(new Path(), {
      start,
      points,
      closed,
    })
  }

  public static deserialize(obj: any) {
    return assign(new Path(), {
      start: obj.start,
      points: obj.points,
      closed: obj.closed,
    })
  }

  protected constructor() {}

  public get svgPath() {
    return pointsToSVGPath(this.start, this.points)
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

  public serialize() {
    return {
      start: { ...this.start },
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
    c1x: number
    c1y: number
    c2x: number
    c2y: number
    x: number
    y: number
    weight?: number
  }
}

const pointsToSVGPath = (start: Path.StartPoint, points: Path.PathPoint[]) => {
  return [
    `M${start.x},${start.y}`,
    ...points.map(
      (point) =>
        `C${point.c1x},${point.c1y} ${point.c2x},${point.c2y} ${point.x},${point.y}`
    ),
  ].join(' ')
}

export { Path }
