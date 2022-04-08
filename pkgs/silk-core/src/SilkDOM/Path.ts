import bounds from 'svg-path-bounds'

import { assign, deepClone } from '../utils'
import { mapPoints } from '../SilkHelpers'
import {
  cachedPointAtLength,
  CachedPointAtLength,
} from '../CachedPointAtLength'
import prand from 'pure-rand'
import { ISilkDOMElement } from './ISilkDOMElement'
import { lerp } from '../SilkMath'

export declare namespace Path {
  export type StartPoint = { x: number; y: number }

  export type WeightPoint = [
    /** 0 to 1 */
    at: number,
    /** 0 to 1 */
    pressure: number
  ]

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
    pressure?: number | null
  }
}

export class Path implements ISilkDOMElement {
  public points: Path.PathPoint[] = []

  /** Is path closed */
  public closed: boolean = false

  /** Random number seed for rendering this path */
  public readonly randomSeed: number = prand.mersenne(Math.random()).next()[0]

  private _pal!: CachedPointAtLength

  public static create({
    points,
    closed,
    randomSeed,
  }: {
    points: Path.PathPoint[]
    closed: boolean
    randomSeed?: number
  }) {
    // const pal =

    // pressureAt(t)
    // TODO: 加速度atTを作る

    const path = assign(new Path(), {
      points,
      // weightPoints:
      closed,
      ...(randomSeed != null ? { randomSeed } : {}),
    })

    return path
  }

  public static deserialize(obj: any) {
    return assign(new Path(), {
      points: obj.points,
      closed: obj.closed,
      randomSeed: obj.randomSeed,
    })
  }

  protected constructor() {}

  public get svgPath() {
    return pointsToSVGPath(this.points, this.closed)
  }

  // public getWeightAt(t: number) {
  //   if (!this.weightPoints) {
  //     this.calcAndCacheWeightPoints()
  //   }

  //   if (t < 0 || t > 1) return 0

  //   for (let idx = 0, l = this.weightPoints.length; idx < l; idx++) {
  //     const [at, weight] = this.weightPoints[idx]
  //     if (at >= t) return lerp(weight, this.weightPoints[idx + 1][1] ?? 0, t)
  //   }

  //   return 0
  // }

  // private calcAndCacheWeightPoints() {
  //   const len = this.getTotalLength()
  //   this.points.forEach(p => {
  //     getLength
  //   })
  // }

  public getBoundingBox() {
    const [left, top, right, bottom] = bounds(this.svgPath)
    const width = Math.abs(right - left)
    const height = Math.abs(bottom - top)

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

  public getTotalLength(): number {
    return this.pal.length()
  }

  public getPointAtLength(pos: number): { x: number; y: number } {
    const [x, y] = this.pal.at(pos)
    return { x, y }
  }

  public getNearPointIdxAtLength(len: number) {
    return this.pal.lengthNearAtNearPoint(len)
  }

  /**
   * @param t Position on the Path, Must be 0..1
   * @returns Pressure 0..1, fallback to .5
   */
  public getPressureAt(t: number) {
    const len = this.getTotalLength() * t
    return this.getPressureAtLength(len)
  }

  /**
   * @param len Target length
   * @returns Pressure 0..1, fallback to .5
   */
  public getPressureAtLength(len: number) {
    const nearPoint = this.getNearPointIdxAtLength(len)

    const prev = findIndex(this.points, (p) => p.pressure != null, {
      from: nearPoint.index,
      increments: -1,
    })!
    const next = findIndex(this.points, (p, idx) => p.pressure != null, {
      from: nearPoint.length === len ? nearPoint.index : nearPoint.index + 1,
      increments: 1,
    })!

    const prevLength = this.pal.lengthOfPoint(prev.index).length
    const nextLength = this.pal.lengthOfPoint(next.index).length
    const segmentLength = nextLength - prevLength

    if (this.points.length !== this.pal._points.length) {
      throw new Error('getPressureAt: WHAT??????')
    }

    // SEE: https://developer.mozilla.org/ja/docs/Web/API/PointerEvent/pressure#return_value
    const defaultPressure = 0.5
    const tAtFragment =
      segmentLength === 0 ? 1 : (len - prevLength) / (nextLength - prevLength)

    return lerp(
      prev.element.pressure ?? defaultPressure,
      next.element.pressure ?? defaultPressure,
      tAtFragment
    )
  }

  public mapPoints<T>(
    proc: (
      point: Path.PathPoint,
      prevPoint: Path.PathPoint | undefined,
      idx: number,
      points: readonly Path.PathPoint[]
    ) => T,
    option: { startOffset?: number } = { startOffset: 0 }
  ): T[] {
    const [start] = this.points
    const points: Path.PathPoint[] = this.closed
      ? [...this.points, start]
      : this.points

    return mapPoints(points, proc, option)
  }

  public update(proc: (entity: this) => void): void {
    proc(this)
    this._pal = cachedPointAtLength(this.svgPath)
  }

  public clone() {
    return Path.create({ points: deepClone(this.points), closed: this.closed })
  }

  public serialize() {
    return {
      points: deepClone(this.points),
      closed: this.closed,
      randomSeed: this.randomSeed,
    }
  }

  private get pal() {
    return (this._pal ??= cachedPointAtLength(this.svgPath))
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
          return `L ${point.x} ${point.y}`
        }
      },
      { startOffset: 1 }
    ).join(' '),
    closed ? 'Z' : '',
  ].join(' ')
}

const rangeMather = <T>(min: number, max: number, result: T) => {
  return {
    match: (value: number) => (value <= max && value >= min ? result : false),
  }
}

const findIndex = <T>(
  arr: T[],
  cb: (el: T, idx: number) => boolean,
  opt: { from: number; increments: number }
) => {
  if (!(opt.from in arr)) return undefined

  for (let i = opt.from; i >= 0 || i < arr.length; i += opt.increments) {
    if (cb(arr[i], i)) return { index: i, element: arr[i] }
  }

  return undefined
}
