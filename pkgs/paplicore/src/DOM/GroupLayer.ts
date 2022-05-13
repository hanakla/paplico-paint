import { v4 } from 'uuid'

import { LayerTypes } from './index'
import { Emitter } from '../Engine3_Emitter'
import { assign, pick } from '../utils/object'
import { deserializeLayer } from './desrializeLayer'
import { Filter } from './Filter'
import { CompositeMode, ILayer, LayerEvents } from './ILayer'
import * as featureTag from './internal/featureTag'

type Events = LayerEvents<GroupLayer> & {
  layersChanged: void
}

export declare namespace GroupLayer {
  export type Attributes = ILayer.Attributes & {
    compositeIsolation: boolean
    layers: LayerTypes[]
  }

  export type PatchableAttributes = Omit<
    GroupLayer.Attributes,
    'uid' | 'layerType' | 'layers'
  >
}

export class GroupLayer extends Emitter<Events> implements ILayer {
  public static readonly patchableAttributes: readonly (keyof GroupLayer.PatchableAttributes)[] =
    Object.freeze([
      'name',
      'visible',
      'lock',
      'compositeMode',
      'opacity',
      'x',
      'y',
      'features',

      'compositeIsolation',
    ])

  public static create({
    layers = [],
    ...attrs
  }: Partial<GroupLayer.PatchableAttributes> & { layers?: LayerTypes[] }) {
    return assign(new GroupLayer(), {
      layers,
      ...pick(attrs, GroupLayer.patchableAttributes),
    })
  }

  public readonly layerType = 'group'

  public readonly uid: string = `grouplayer-${v4()}`
  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false

  public compositeMode: CompositeMode = 'normal'
  public opacity: number = 100
  public x: number = 0
  public y: number = 0

  /**
   * When compositeIsolation is true, Renderresult will aggregate to isolated new buffer and composite it to destination
   * Otherwise, Each layer render result will be composited to destination directory
   */
  public compositeIsolation: boolean = true

  public readonly features = Object.create(null)

  /** Compositing "next on current" */
  public readonly layers: LayerTypes[] = []
  public readonly filters: Filter[] = []

  public static deserialize(obj: any) {
    return assign(new GroupLayer(), {
      uid: obj.uid,
      name: obj.name,
      visible: obj.visible,
      lock: obj.lock,
      compositeMode: obj.compositeMode,
      opacity: obj.opacity,
      x: obj.x,
      y: obj.y,
      layers: obj.layers.map((l: any) => deserializeLayer(l)),
    })
  }

  protected constructor() {
    super()
  }

  public hasFeature = featureTag.hasFeature
  public enableFeature = featureTag.enableFeature
  public getFeatureSetting = featureTag.getFeatureSetting
  public patchFeatureSetting = featureTag.patchFeatureSetting

  public get width() {
    return 0
  }

  public get height() {
    return 0
  }

  public update(proc: (layer: this) => void) {
    const prevLength = this.layers.length

    proc(this)
    this.emit('updated', this)

    if (prevLength !== this.layers.length) this.emit('layersChanged')
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
      layers: this.layers.map((l) => l.serialize()),
      filters: this.filters.map((f) => f.serialize()),
      features: this.features,
    }
  }

  public clone(): this {
    return GroupLayer.deserialize(
      assign(this.serialize(), { uid: `grouplayer-${v4()}` })
    ) as this
  }
}
