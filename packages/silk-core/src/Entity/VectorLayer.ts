import { ILayer } from './IRenderable'
import { v4 } from 'uuid'
import { Path } from './Path'
import spline from '@yr/catmull-rom-spline'
import { VectorObject } from './VectorObject'
import { SilkEntity } from 'index'

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

    const path = Path.create({
      points: [
        { x: 0, y: 0, in: { x: 0, y: 0 }, out: { x: 0, y: 0 } },
        { x: 200, y: 500, in: { x: 200, y: 500 }, out: { x: 200, y: 500 } },
        { x: 600, y: 500, in: { x: 600, y: 500 }, out: { x: 600, y: 500 } },
        {
          x: 1000,
          y: 1000,
          in: { x: 1000, y: 1000 },
          out: { x: 1000, y: 1000 },
        },
      ],
      closed: true,
    })

    const obj = VectorObject.create({ x: 0, y: 0, path })

    obj.brush = {
      brushId: '@silk-paint/brush',
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
      weight: 1,
    }

    obj.fill = {
      type: 'linear-gradient',
      opacity: 1,
      start: { x: -100, y: -100 },
      end: { x: 100, y: 100 },
      colorPoints: [
        { color: { r: 0, g: 255, b: 255, a: 1 }, position: 0 },
        { color: { r: 128, g: 255, b: 200, a: 1 }, position: 1 },
      ],
    }

    layer.objects.push(obj)

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
