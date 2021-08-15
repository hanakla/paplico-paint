import { ILayer } from './IRenderable'
import { v4 } from 'uuid'
import { assign } from '../utils'
import { Filter } from './Filter'

export class FilterLayer implements ILayer {
  public readonly layerType = 'filter'

  public readonly id: string = `filterlayer-${v4()}`
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

  protected constructor() {}

  public get lastUpdatedAt() {
    return this._lastUpdatedAt
  }

  public update(proc: (layer: FilterLayer) => void) {
    proc(this)
    this._lastUpdatedAt = Date.now()
  }

  public serialize() {
    return {
      id: this.id,
      name: this.name,
      visible: this.visible,
      lock: this.lock,
      compositeMode: this.compositeMode,
      opacity: this.opacity,
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
    }
  }
}
