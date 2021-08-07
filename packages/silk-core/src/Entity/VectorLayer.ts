import { ILayer } from './IRenderable'
import { v4 } from 'uuid'
import { Path } from './Path'
import spline from '@yr/catmull-rom-spline'
import { VectorObject } from './VectorObject'

export class VectorLayer implements ILayer {
  public readonly layerType = 'vector'

  public readonly id: string = `vectorlayer-${v4()}`
  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeMode: ILayer['compositeMode'] = 'normal'
  public opacity: number = 100

  // public width: number = 0
  // public height: number = 0
  public x: number = 0
  public y: number = 0

  public readonly objects: VectorObject[] = []

  /** Mark for re-rendering decision */
  protected _lastUpdatedAt = Date.now()

  public static create({ width, height }: { width: number; height: number }) {
    const layer = new VectorLayer()

    const sp = spline.points(
      [
        [0, 0, 1],
        [200, 500, 1],
        [600, 500, 1],
        [1000, 1000, 1],
      ].map(([x, y]) => [x, y])
    )

    const [start, ...points] = sp
    const objectPoints = points.map(([c1x, c1y, c2x, c2y, x, y]: number[]) => ({
      c1x,
      c1y,
      c2x,
      c2y,
      x,
      y,
    }))

    const path = Path.create({
      start: { x: start[0], y: start[1] },
      points: objectPoints,
      svgPath: spline.svgPath(sp),
    })
    layer.objects.push(VectorObject.create({ x: 0, y: 0, path }))

    return layer
  }

  public static deserialize(o: any) {}

  protected constructor() {}

  public get lastUpdatedAt() {
    return this._lastUpdatedAt
  }

  public update(proc: (layer: VectorLayer) => void) {
    proc(this)
    this._lastUpdatedAt = Date.now()
  }

  public serialize() {
    return {}
  }

  public get width() {
    return 0
  }

  public get height() {
    return 0
  }
}
