import { LayerTypes } from 'SilkDOM'
import { v4 } from 'uuid'

import { Emitter } from '../Engine3_Emitter'
import { assign } from '../utils'
import { deserializeLayer } from './desrializeLayer'
import { Filter } from './Filter'
import { CompositeMode, ILayer, LayerEvents } from './IRenderable'

type Events = LayerEvents<GroupLayer>

type SubLayerTypes = Exclude<LayerTypes, GroupLayer>

export class GroupLayer extends Emitter<Events> implements ILayer {
  public static create({ layers = [] }: { layers?: SubLayerTypes[] }) {
    return assign(new GroupLayer(), {
      layers,
    })
  }

  public readonly layerType = 'group'

  public readonly uid: string = `grouplayer-${v4()}`
  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeIsolation: boolean = false
  public compositeMode: CompositeMode = 'normal'
  public opacity: number = 100
  public x: number = 0
  public y: number = 0

  /** Compositing "next on current" */
  public layers: SubLayerTypes[] = []
  public filters: Filter[] = []

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

  public get width() {
    return 0
  }

  public get height() {
    return 0
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
      layers: this.layers.map((l) => l.serialize()),
      filters: this.filters.map((f) => f.serialize()),
    }
  }

  public clone(): this {
    return GroupLayer.deserialize(
      assign(this.serialize(), { uid: `grouplayer-${v4()}` })
    ) as this
  }
}
