import simplify from '@luncheon/simplify-svg-path'
import { pathBounds } from '../fastsvg/pathBounds'

import { assign, deepClone } from '../utils'
import { mapPoints } from '../PapHelpers'
import {
  cachedPointAtLength,
  CachedPointAtLength,
} from '../fastsvg/CachedPointAtLength'
import prand from 'pure-rand'
import { ISilkDOMElement } from './ISilkDOMElement'
import { lerp } from '../PapMath'

export declare namespace Path {
  export type Attributes = {
    points: PathPoint[]
    closed: boolean
    randomSeed: number
  }

  export type SerializedAttibutes = Attributes

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
    deltaTime?: number
  }

  export type PathBBox = {
    left: number
    top: number
    right: number
    bottom: number
    centerX: number
    centerY: number
    width: number
    height: number
  }
}

export class Path implements ISilkDOMElement {
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

  public static deserialize(obj: Path.Attributes) {
    return assign(new Path(), {
      points: obj.points,
      closed: obj.closed,
      randomSeed: obj.randomSeed,
    })
  }

  /** Identifier of content, it changed only after .update() called or cloned instance */
  public points: Path.PathPoint[] = []

  /** Is path closed */
  public closed: boolean = false

  /** Random number seed for rendering this path */
  public readonly randomSeed: number = prand.mersenne(Math.random()).next()[0]

  private _pal!: CachedPointAtLength
  private _cachedSvgPath: string | null = null
  private _cachedBounds: Path.PathBBox | null = null
  private _isFreezed: boolean = false

  protected constructor() {}

  public get isFreezed() {
    return this._isFreezed
  }

  public get svgPath() {
    if (this._cachedSvgPath) return this._cachedSvgPath
    return this.getFreshSVGPath()
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

  public getBoundingBox(): Path.PathBBox {
    if (this._cachedBounds) return this._cachedBounds

    const [left, top, right, bottom] = pathBounds(this.svgPath)
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

    const fallbackLast = this.closed
      ? { index: 0, element: this.points[0] }
      : {
          index: this.points.length - 1,
          element: this.points[this.points.length - 1],
        }

    const prev = findIndex(this.points, (p) => p.pressure != null, {
      from: nearPoint.index,
      increments: -1,
    }) ?? { index: 0, element: this.points[0] }
    const next =
      findIndex(this.points, (p) => p.pressure != null, {
        from: nearPoint.index + 1,
        increments: 1,
      }) ?? fallbackLast

    const prevLength = this.pal.lengthOfPoint(prev.index).length
    const nextLength = this.pal.lengthOfPoint(next.index).length
    const segmentLength = nextLength - prevLength

    // SEE: https://developer.mozilla.org/ja/docs/Web/API/PointerEvent/pressure#return_value
    const defaultPressure = 0.5
    const tAtFragment =
      segmentLength === 0 ? 1 : (len - prevLength) / segmentLength

    return lerp(
      prev.element.pressure ?? defaultPressure,
      next.element.pressure ?? defaultPressure,
      tAtFragment
    )
  }

  public simplify(
    options: {
      tolerance?: number
      precision?: number
    } = {}
  ) {
    // simplify(
    //   this.points.map((p) => ({ x: p.x, y: p.y })),
    //   { ...options, closed: this.closed }
    // )
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

    this._cachedSvgPath = this.getFreshSVGPath()
    this._pal = cachedPointAtLength(this.svgPath)
  }

  /** Freeze changes and cache heavily process results */
  public freeze() {
    if (this._isFreezed) throw new Error('Path is already freezed')

    this._cachedSvgPath = this.getFreshSVGPath()
    this._pal = cachedPointAtLength(this._cachedSvgPath)
    this._cachedBounds = this.getBoundingBox()

    this._isFreezed = true
    Object.freeze(this)
    Object.freeze(this.points)
  }

  public clone() {
    return Path.create({
      points: deepClone(this.points),
      closed: this.closed,
      randomSeed: this.randomSeed,
    })
  }

  public serialize(): Path.Attributes {
    return {
      points: deepClone(this.points),
      closed: this.closed,
      randomSeed: this.randomSeed,
    }
  }

  private getFreshSVGPath() {
    return pointsToSVGPath(this.points, this.closed)
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
      [...points, ...(closed ? [points[0]] : [])],
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

  for (let i = opt.from; i >= 0 && i < arr.length; i += opt.increments) {
    if (cb(arr[i], i)) return { index: i, element: arr[i] }
  }

  return undefined
}
