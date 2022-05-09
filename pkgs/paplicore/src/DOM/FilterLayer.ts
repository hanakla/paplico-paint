import { v4 } from 'uuid'

import { ILayer, LayerEvents } from './ILayer'
import { assign } from '../utils'
import { Filter } from './Filter'
import { Emitter } from '../Engine3_Emitter'

type Events = LayerEvents<FilterLayer>

export class FilterLayer extends Emitter<Events> implements ILayer {
  public readonly layerType = 'filter'

  public readonly uid: string = `filterlayer-${v4()}`
  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeMode: ILayer['compositeMode'] = 'normal' as const
  public opacity: number = 100

  public width: number = 0
  public height: number = 0
  public x: number = 0
  public y: number = 0
  public filters: Filter[] = []

  /** Mark for re-rendering decision */
  protected _lastUpdatedAt = Date.now()

  public static create(properties: {}) {
    const layer = new FilterLayer()

    assign(layer, {
      width: 0,
      height: 0,
    })

    return layer
  }

  public static deserialize(obj: any) {
    return assign(new FilterLayer(), {
      uid: obj.uid,
      name: obj.name,
      visible: obj.visible,
      lock: obj.lock,
      compositeMode: obj.compositeMode,
      opacity: obj.opacity,
      width: obj.width,
      height: obj.height,
      x: obj.x,
      y: obj.y,
      filters: obj.filters.map((f: any) => Filter.deserialize(f)),
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
      uid: this.uid,
      name: this.name,
      visible: this.visible,
      lock: this.lock,
      compositeMode: this.compositeMode,
      opacity: this.opacity,
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
      filters: this.filters.map((f) => f.serialize()),
    }
  }

  public clone(): this {
    return FilterLayer.deserialize(
      assign(this.serialize(), { uid: `filterlayer-${v4()}` })
    ) as this
  }
}