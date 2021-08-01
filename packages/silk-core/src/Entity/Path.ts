type PathPoint = {
  c1x: number
  c1y: number
  c2x: number
  c2y: number
  x: number
  y: number
  weight?: number
}

export class Path {
  public start: { x: number, y: number }
  public points: PathPoint[]
  public svgPath: string

  constructor({
    start,
    points,
    svgPath
  } : {
    start: { x: number, y: number },
    points: PathPoint[],
    svgPath: string
  }) {
    this.start = start
    this.points = points
    this.svgPath = svgPath
  }
}
