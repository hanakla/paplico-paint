import { ILayer, LayerEvents } from './ILayer'
import { v4 } from 'uuid'
import { VectorObject } from './VectorObject'
import { Filter } from './Filter'
import { assign, pick } from '../utils/object'
import { Emitter } from '../Engine3_Emitter'
import * as featureTag from './internal/featureTag'

type Events = LayerEvents<VectorLayer>

export declare namespace VectorLayer {
  export type Attributes = ILayer.Attributes

  export type PatchableAttributes = Omit<
    Attributes,
    'uid' | 'layerType' | 'width' | 'height'
  >
}

export class VectorLayer extends Emitter<Events> implements ILayer {
  public static readonly patchableAttributes: readonly (keyof VectorLayer.PatchableAttributes)[] =
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

  public readonly layerType = 'vector'

  public readonly uid: string = `vectorlayer-${v4()}`
  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeMode: ILayer['compositeMode'] = 'normal'
  public opacity: number = 100

  // public width: number = 0
  // public height: number = 0
  public x: number = 0
  public y: number = 0

  /** Compositing first to last (last is foreground) */
  public readonly objects: VectorObject[] = []
  public readonly filters: Filter[] = []
  public readonly features = Object.create(null)

  /** Mark for re-rendering decision */
  protected _lastUpdatedAt = Date.now()
  // protected _transaction = new AtomicResource({})

  public static create(
    attrs: Partial<
      VectorLayer.PatchableAttributes & {
        objects: VectorObject[]
      }
    >
  ) {
    return assign(
      new VectorLayer(),
      pick(attrs, VectorLayer.patchableAttributes)
    )
  }

  public static deserialize(obj: any) {
    return assign(new VectorLayer(), {
      uid: obj.uid,
      name: obj.name,
      visible: obj.visible,
      lock: obj.lock,
      compositeMode: obj.compositeMode,
      opacity: obj.opacity,
      x: obj.x,
      y: obj.y,
      objects: obj.objects.map((obj: any) => VectorObject.deserialize(obj)),
      filters: obj.filters.map((filter: any) => Filter.deserialize(filter)),
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

  // public createTransaction() {
  //   enablePatches()

  //   const patches: Patch[] = []
  //   const inverses: Patch[] = []

  //   const base: VectorLayer = Object.setPrototypeOf(
  //     { ...this },
  //     VectorLayer.prototype
  //   )

  //   return {
  //     update: (patcher: (layer: VectorLayer) => void) => {
  //       base[immerable] = true

  //       const [, patches, inverse] = produceWithPatches(base, patcher)
  //       patches.push(...patches)
  //       inverses.push(...inverse)

  //       console.log(patches)
  //       this[immerable] = true
  //       applyPatches(this, patches)
  //       base[immerable] = false
  //     },
  //     rollback: () => {
  //       applyPatches(this, inverses)
  //     },
  //     commit: () => {
  //       applyPatches(this, patches)
  //     },
  //   }
  // }

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
      x: this.x,
      y: this.y,
      objects: this.objects.map((o) => o.serialize()),
      filters: this.filters.map((f) => f.serialize()),
      features: this.features,
    }
  }

  public clone(): this {
    return VectorLayer.deserialize(
      assign(this.serialize(), { uid: `vectorlayer-${v4()}` })
    ) as this
  }

  public get width() {
    return 0
  }

  public get height() {
    return 0
  }
}
