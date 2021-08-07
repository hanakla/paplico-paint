import { assign } from '../utils'

class Path {
  public start: { x: number; y: number } = { x: 0, y: 0 }
  public points: Path.PathPoint[] = []
  public closed: boolean = false

  public static create({
    start,
    points,
    svgPath,
  }: {
    start: Path.StartPoint
    points: Path.PathPoint[]
    svgPath: string
  }) {
    return assign(new Path(), {
      start: start,
      points: points,
    })
  }

  public static deserialize(obj: any) {
    return assign(new Path(), {
      start: obj.start,
      points: obj.points,
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

  public serialize() {
    return {
      start: { ...this.start },
      points: [...this.points],
      closed: this.closed,
    }
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
