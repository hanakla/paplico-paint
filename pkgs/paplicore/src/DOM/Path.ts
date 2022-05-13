import simplify from '@luncheon/simplify-svg-path'

import { pathBounds } from '../fastsvg/pathBounds'
import { assign, deepClone } from '../utils/object'
import { mapPoints } from '../PapHelpers'
import {
  cachedPointAtLength,
  CachedPointAtLength,
} from '../fastsvg/CachedPointAtLength'
import prand from 'pure-rand'
import { ISilkDOMElement } from './ISilkDOMElement'
import { lerp } from '../utils/math'
import { parseSVGPath } from '../fastsvg/parse'
import abs from 'abs-svg-path'
import { svgPathProperties } from 'svg-path-properties'
import { createSequencialTangentsReader } from './internal/Path.sequencials.tangents'

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
    /** Absolute position on canvas */
    in: { x: number; y: number } | null
    /** Absolute position on canvas */
    out: { x: number; y: number } | null
    // c1x: number
    // c1y: number
    // c2x: number
    // c2y: number
    x: number
    y: number
    /** 0 to 1 */
    pressure?: number | null
    /** milliseconds to this point from previous point */
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
  private _pathProps!: InstanceType<typeof svgPathProperties>
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

  public get pathProps(): any {
    if (this._pathProps) return this._pathProps
    return (this._pathProps = new svgPathProperties(this.svgPath))
  }

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

  public getTotalLength(): number {
    return this.pal.length()
  }

  public getPointAt(t: number): { x: number; y: number } {
    return this.getPointAtLength(t * this.getTotalLength())
  }

  public getPointAtLength(pos: number): { x: number; y: number } {
    const [x, y] = this.pal.at(pos)
    return { x, y }
  }

  public getNearPointIdxAtLength(len: number) {
    return this.pal.nearPointAtLength(len)
  }

  public getSequencialPointsReader() {
    let prevLen = -Infinity
    let lastIndex = 0
    const pal = this.pal
    const total = this.getTotalLength()

    const fallbackLast = this.closed
      ? { index: 0, element: this.points[0] }
      : {
          index: this.points.length - 1,
          element: this.points[this.points.length - 1],
        }

    const reader = {
      getPointAtIndex: (idx: number) => {
        return pal.lengthOfPoint(idx)
      },
      getPointAt: (t: number, { seek = true }: { seek?: boolean } = {}) => {
        const len = total * t
        return reader.getPointAtLength(len, { seek })
      },
      getPointAtLength: (
        len: number,
        { seek = true }: { seek?: boolean } = {}
      ) => {
        if (len < prevLen) {
          throw new Error(
            `sequencialPointAtLength : Querying length too small than previous length (previous: ${prevLen}, query: ${len})`
          )
        }

        const result = pal.atWithDetail(len, { hintIndexGTEq: lastIndex })

        if (seek) {
          lastIndex = result.lastIndex
          prevLen = len
        }

        return { x: result.pos[0], y: result.pos[1] }
      },
    }

    return reader
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

  public getSequencialPressuresReader() {
    let prevLen = -Infinity
    let lastIndex = 0
    const total = this.getTotalLength()
    const pal = this.pal

    const fallbackLast = this.closed
      ? { index: 0, element: this.points[0] }
      : {
          index: this.points.length - 1,
          element: this.points[this.points.length - 1],
        }

    const reader = {
      getPressureAt: (t: number) => {
        const len = total * t
        return reader.getPressureAtLength(len)
      },
      getPressureAtLength: (
        len: number,
        { seek = true }: { seek?: boolean } = {}
      ) => {
        if (len < prevLen) {
          throw new Error(
            `sequencialPressureAtLength: Querying length too small than previous length (previous: ${prevLen}, query: ${len})`
          )
        }

        const prev = findIndex(this.points, (p) => p.pressure != null, {
          from: lastIndex,
          increments: -1,
        }) ?? { index: 0, element: this.points[0] }

        const next =
          findIndex(this.points, (p) => p.pressure != null, {
            from: lastIndex + 1,
            increments: 1,
          }) ?? fallbackLast

        const prevLength = pal.lengthOfPoint(prev.index).length
        const nextLength = pal.lengthOfPoint(next.index).length

        const segmentLength = nextLength - prevLength

        // SEE: https://developer.mozilla.org/ja/docs/Web/API/PointerEvent/pressure#return_value
        const defaultPressure = 0.5
        const tOnFragment =
          segmentLength === 0 ? 1 : (len - prevLength) / segmentLength

        if (seek) {
          prevLen = len
          lastIndex = prev.index
        }

        return lerp(
          prev.element.pressure ?? defaultPressure,
          next.element.pressure ?? defaultPressure,
          tOnFragment
        )
      },
    }

    return reader
  }

  public getTangentAt(t: number) {
    const len: number = this.getTotalLength() * t
    return this.getTangentAtLength(len)
  }

  public getTangentAtLength(len: number) {
    return this.pathProps.getTangentAtLength(len)
  }

  public getSequencialTangentsReader() {
    const totalLength = this.getTotalLength()
    const pointsReader = this.getSequencialPointsReader()

    const reader = {
      getTangentAt: (t: number) => {
        return reader.getTangentAtLength(t * totalLength)
      },
      getTangentAtLength: (len: number) => {
        // Original: https://gist.github.com/enjalot/ce4c4409fb80559de2bd

        // returns a normalized vector that describes the tangent
        // at the point that is found at *percent* of the path's length

        const p1 = pointsReader.getPointAtLength(len - 0.1, { seek: true })
        const p2 = pointsReader.getPointAtLength(len + 0.1, { seek: false })
        // console.log('p', p2.x, p2.y)

        const vector = { x: p2.x - p1.x, y: p2.y - p1.y }
        // const tan = Math.atan2(p2.y - p1.y, p2.x - p1.x)

        const magnitude = Math.sqrt(vector.x * vector.x + vector.y * vector.y)
        vector.x /= magnitude
        vector.y /= magnitude

        return vector
      },
    }

    return reader
  }

  public getSimplifiedPath({
    tolerance = 3,
    precision = 4,
  }: {
    tolerance?: number
    precision?: number
  } = {}) {
    const stringPath = simplify(
      this.points.map((p) => [p.x, p.y]),
      { tolerance, precision, closed: this.closed }
    )

    const svgPoints = abs(parseSVGPath(stringPath)) as [string, ...number[]][]
    const pal = cachedPointAtLength(stringPath)

    const newPoints = svgPoints.map(([cmd, ...args], idx): Path.PathPoint => {
      const next = svgPoints[idx + 1]

      switch (cmd) {
        case 'M':
          return {
            x: args[0],
            y: args[1],
            in: null,
            out: next ? { x: next[1], y: next[2] } : null,
            pressure: this.getPressureAtLength(pal.lengthOfPoint(idx).length),
          }
        case 'C':
          return {
            x: args[4],
            y: args[5],
            in: { x: args[2], y: args[3] },
            out: next ? { x: next[1], y: next[2] } : null,
            pressure: this.getPressureAtLength(pal.lengthOfPoint(idx).length),
          }
        default: {
          throw new Error(`Unexpected command type ${cmd}`)
        }
      }
    })

    return assign(new Path(), {
      points: newPoints,
      closed: this.closed,
    })
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
    this._cachedBounds = null
    this._cachedBounds = this.getBoundingBox()
    this._pathProps = new svgPathProperties(this._cachedSvgPath)
  }

  /** Freeze changes and cache heavily process results */
  public freeze() {
    if (this._isFreezed) throw new Error('Path is already freezed')

    this._cachedSvgPath = this.getFreshSVGPath()
    this._pal = cachedPointAtLength(this._cachedSvgPath)
    this._cachedBounds = this.getBoundingBox()
    this._pathProps = new svgPathProperties(this._cachedSvgPath)

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
