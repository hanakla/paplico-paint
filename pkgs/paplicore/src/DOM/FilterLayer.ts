import { v4 } from 'uuid'

import { ILayer, LayerEvents } from './ILayer'
import { assign, pick } from '../utils/object'
import { Filter } from './Filter'
import { Emitter } from '../Engine3_Emitter'
import * as featureTag from './internal/featureTag'

type Events = LayerEvents<FilterLayer>

export declare namespace FilterLayer {
  export type Attributes = ILayer.Attributes

  export type PatchableAttributes = Omit<
    Attributes,
    'uid' | 'layerType' | 'width' | 'height'
  >
}

export class FilterLayer extends Emitter<Events> implements ILayer {
  public static readonly patchableAttributes: readonly (keyof FilterLayer.PatchableAttributes)[] =
    Object.freeze([
      'name',
      'visible',
      'lock',
      'compositeMode',
      'opacity',
      'x',
      'y',
      'features',
    ])

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
  public readonly filters: Filter[] = []
  public readonly features = Object.create(null)

  /** Mark for re-rendering decision */
  protected _lastUpdatedAt = Date.now()

  public static create(
    attrs: Partial<
      Omit<ILayer.Attributes, 'uid' | 'layerType' | 'width' | 'height'>
    >
  ) {
    return assign(new FilterLayer(), {
      width: 0,
      height: 0,
      ...pick(attrs, FilterLayer.patchableAttributes),
    })
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
      features: obj.features,
    })
  }

  protected constructor() {
    super()
  }

  public hasFeature = featureTag.hasFeature
  public enableFeature = featureTag.enableFeature
  public getFeatureSetting = featureTag.getFeatureSetting
  public patchFeatureSetting = featureTag.patchFeatureSetting

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
      features: this.features,
    }
  }

  public clone(): this {
    return FilterLayer.deserialize(
      assign(this.serialize(), { uid: `filterlayer-${v4()}` })
    ) as this
  }
}
