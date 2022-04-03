import { ILayer, LayerEvents } from './IRenderable'
import { v4 } from 'uuid'
import { Path } from './Path'
import { VectorObject } from './VectorObject'
import { Filter } from './Filter'
import { assign } from '../utils'
import { Emitter } from '../Engine3_Emitter'

type Events = LayerEvents<VectorLayer>

export class VectorLayer extends Emitter<Events> implements ILayer {
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
  public readonly filters: Filter[] = []

  /** Mark for re-rendering decision */
  protected _lastUpdatedAt = Date.now()

  public static create({}: {}) {
    const layer = new VectorLayer()

    const path = Path.create({
      points: [
        { x: 0, y: 0, in: null, out: null },
        { x: 200, y: 500, in: null, out: null },
        { x: 600, y: 500, in: null, out: null },
        {
          x: 1000,
          y: 1000,
          in: null,
          out: null,
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

  public static deserialize(obj: any) {
    return assign(new VectorLayer(), {
      id: obj.id,
      name: obj.name,
      visible: obj.visible,
      lock: obj.lock,
      compositeMode: obj.compositeMode,
      opacity: obj.opacity,
      x: obj.x,
      y: obj.y,
      objects: obj.objects.map((obj: any) => VectorObject.deserialize(obj)),
      filters: obj.filters.map((filter: any) => Filter.deserialize(filter)),
    })
  }

  protected constructor() {
    super()
  }

  public get lastUpdatedAt() {
    return this._lastUpdatedAt
  }

  public update(proc: (layer: this) => void) {
    proc(this)
    this._lastUpdatedAt = Date.now()
    this.emit('updated', this)
  }

  public serialize() {
    return {
      layerType: this.layerType,
      id: this.id,
      name: this.name,
      visible: this.visible,
      lock: this.lock,
      compositeMode: this.compositeMode,
      opacity: this.opacity,
      x: this.x,
      y: this.y,
      objects: this.objects.map((o) => o.serialize()),
      filters: this.filters.map((f) => f.serialize()),
    }
  }

  public get width() {
    return 0
  }

  public get height() {
    return 0
  }
}
