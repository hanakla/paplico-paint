import { Path } from '../SilkDOM/Path'
import spline from '@yr/catmull-rom-spline'
import { nanoid } from 'nanoid'
import simplify from 'simplify-js'

type StrokePoint = [
  /** Absolute position on canvas */
  x: number,
  /** Absolute position on canvas */
  y: number,
  /** 0 to 1 */
  pressure: number
  // time
]

export class Stroke {
  public static fromPath(
    path: Path,
    mapPoint?: (p: Path.PathPoint) => Path.PathPoint
  ) {
    const cloned = path.clone()

    if (mapPoint) {
      cloned.points = cloned.points.map((p) => mapPoint(p))
    }

    const stroke = new Stroke()
    stroke.points = cloned.points.map((point) => [
      point.x,
      point.y,
      point.pressure ?? 0.5,
    ])
    stroke._path = cloned

    return stroke
  }

  protected _splined: Path | null = null
  protected _path: Path | null = null

  public id: string = nanoid()
  public points: StrokePoint[] = []

  public get path() {
    if (this._path) return this._path

    return (this._path = Path.create({
      points: this.points.map((p) => ({
        x: p[0],
        y: p[1],
        in: null,
        out: null,
        pressure: p[2],
      })),
      closed: false,
    }))
  }

  public get splinedPath() {
    if (this._splined) return this._splined

    const rawPoints = this.points.map(([x, y]) => [x, y] as [number, number])
    const splined = spline.points(rawPoints) as number[][]
    const [start, ...points] = splined

    let prevMatchIdx = 0
    const objectPoints = points.map(
      ([c1x, c1y, c2x, c2y, x, y], idx, list): Path.PathPoint => {
        const next = list[idx + 1]

        // Splineでポイントが増えることはないかもしれない…
        // ないならこの検索はいらない
        let sourcePointIdx = this.points
          .slice(prevMatchIdx)
          .findIndex((p) => p[0] === x && p[1] === y)

        sourcePointIdx = prevMatchIdx + sourcePointIdx

        if (sourcePointIdx !== -1) {
          prevMatchIdx = sourcePointIdx
        }

        return {
          x,
          y,
          in: { x: c2x, y: c2y },
          out: next ? { x: next[0], y: next[1] } : null,
          pressure:
            sourcePointIdx !== -1 ? this.points[sourcePointIdx][2] : null,
        }
      }
    )

    return (this._splined = Path.create({
      points: [
        {
          x: start[0],
          y: start[1],
          in: null,
          out: null,
          pressure: this.points[0][2],
        },
        ...objectPoints,
      ],
      closed: false,
    }))
  }

  public updatePoints(proc: (stroke: StrokePoint[]) => void) {
    proc(this.points)
    this._path = null
    this._splined = null
  }

  public simplify() {
    const points = simplify(this.path.points)

    // pressureAtのマップを先に作る
    this.path.points = points.map((p) => ({
      x: p.x,
      y: p.y,
      in: null,
      out: null,
      pressure: null,
    }))
  }

  public seal() {
    if (!this._path) this.path.closed
    if (!this._splined) this.splinedPath.closed

    Object.freeze(this)
    Object.freeze(this.points)
  }
}
