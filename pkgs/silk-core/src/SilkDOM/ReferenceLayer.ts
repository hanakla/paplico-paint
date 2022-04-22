import { v4 } from 'uuid'
import { Emitter } from '../Engine3_Emitter'
import { assign } from '../utils'
import { Filter } from './Filter'
import { CompositeMode, ILayer, LayerEvents } from './ILayer'

export class ReferenceLayer
  extends Emitter<LayerEvents<ReferenceLayer>>
  implements ILayer
{
  public static create({ referencedLayerId }: { referencedLayerId: string }) {
    return assign(new ReferenceLayer(), {
      referencedLayerId,
    })
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
  public filters: Filter[] = []

  protected constructor() {
    super()
  }

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
    }
  }

  public clone(): this {
    return ReferenceLayer.deserialize(
      assign(this.serialize(), { uid: `reference-layer-${v4()}` })
    ) as this
  }
}
