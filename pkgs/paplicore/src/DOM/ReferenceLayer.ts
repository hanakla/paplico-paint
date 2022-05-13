import { v4 } from 'uuid'
import { Emitter } from '../Engine3_Emitter'
import { assign, pick } from '../utils/object'
import { Filter } from './Filter'
import { CompositeMode, ILayer, LayerEvents } from './ILayer'
import * as featureTag from './internal/featureTag'

export declare namespace ReferenceLayer {
  export type Attributes = ILayer.Attributes & {
    referencedLayerId: string
  }

  export type PatchableAttributes = Omit<
    Attributes,
    'uid' | 'layerType' | 'width' | 'height'
  >
}

export class ReferenceLayer
  extends Emitter<LayerEvents<ReferenceLayer>>
  implements ILayer
{
  public static readonly patchableAttributes: readonly (keyof ReferenceLayer.PatchableAttributes)[] =
    Object.freeze([
      'name',
      'visible',
      'lock',
      'compositeMode',
      'opacity',

      'x',
      'y',

      'features',

      'referencedLayerId',
    ])

  public static create(attrs: Partial<ReferenceLayer.PatchableAttributes>) {
    return assign(
      new ReferenceLayer(),
      pick(attrs, ReferenceLayer.patchableAttributes)
    )
  }

  public static deserialize(obj: any) {
    return assign(new ReferenceLayer(), {
      layerType: obj.layerType,
      uid: obj.uid,
      name: obj.name,
      visible: obj.visible,
      lock: obj.lock,
      compositeMode: obj.compositeMode,
      opacity: obj.opacity,
      x: obj.x,
      y: obj.y,
      referencedLayerId: obj.referencedLayerId,
      filters: obj.filters.map((filter: any) => Filter.deserialize(filter)),
      features: obj.features,
    })
  }

  public uid: string = `reference-layer-${v4()}`

  public readonly layerType = 'reference'
  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeMode: CompositeMode = 'normal'
  public opacity: number = 100

  public width: number = 0
  public height: number = 0
  public x: number = 0
  public y: number = 0

  public referencedLayerId!: string
  public readonly filters: Filter[] = []
  public readonly features = Object.create(null)

  protected constructor() {
    super()
  }

  public hasFeature = featureTag.hasFeature
  public enableFeature = featureTag.enableFeature
  public getFeatureSetting = featureTag.getFeatureSetting
  public patchFeatureSetting = featureTag.patchFeatureSetting

  public update(proc: (layer: this) => void) {
    proc(this)
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
      x: this.x,
      y: this.y,
      referencedLayerId: this.referencedLayerId,
      filters: this.filters.map((f) => f.serialize()),
      features: this.features,
    }
  }

  public clone(): this {
    return ReferenceLayer.deserialize(
      assign(this.serialize(), { uid: `reference-layer-${v4()}` })
    ) as this
  }
}
