import { Path } from '../Entity/Path'
import spline from '@yr/catmull-rom-spline'
import point from 'point-at-length'

type StrokePoint = [x: number, y: number, weight: number]
export class Stroke {
  protected _splined: Path | null = null
  protected _length: number | null = null
  protected _pts: any

  public points: StrokePoint[] = []

  public get splinedPath() {
    if (this._splined) return this._splined

    const rawPoints = this.points.map(([x, y]) => [x, y])
    const splined = spline.points(rawPoints)
    const [start, ...points] = splined
    const svgPath: string = spline.svgPath(splined)
    const objectPoints = points.map(([c1x, c1y, c2x, c2y, x, y]: number[]) => ({
      c1x,
      c1y,
      c2x,
      c2y,
      x,
      y,
    }))

    return (this._splined = new Path({
      start: { x: start[0], y: start[1] },
      points: objectPoints,
      svgPath,
    }))
  }

  public get length() {
    if (this._length != null) return this._length

    return (this._length = this.pts.length())
  }

  public pointAtLength(len: number): [x: number, y: number] {
    return this.pts.at(len)
  }

  public eachSplinePoint(
    callback: (point: [x: number, y: number, force: number]) => void
  ) {
    const vertSize = this.splinedPath.points.length

    for (let i = 0; i < vertSize + 1; i++) {
      const at = i / vertSize
      const len = this.length * at
      const [x, y] = this.pointAtLength(len)

      callback([x, y, 1])
    }
  }

  public updatePoints(proc: (stroke: StrokePoint[]) => void) {
    proc(this.points)

    this._splined = null
    this._pts = null
    this._length = null
  }

  private get pts() {
    if (this._pts != null) return this._pts
    return (this._pts = point(this.splinedPath.svgPath))
  }
}
