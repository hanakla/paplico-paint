import { Emitter } from '../Engine3_Emitter'
import { assign } from '../utils'
import { CompositeMode, ILayer, LayerEvents } from './IRenderable'

type Events = LayerEvents<GroupLayer>

export class GroupLayer extends Emitter<Events> implements ILayer {
  public readonly layerType = 'group'

  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeMode: CompositeMode = 'normal'
  public opacity: number = 100
  public x: number = 0
  public y: number = 0

  public layers: ILayer[] = []

  public static deserialize(obj: any) {
    return assign(new GroupLayer(), {
      name: obj.name,
      visible: obj.visible,
      lock: obj.lock,
      compositeMode: obj.compositeMode,
      opacity: obj.opacity,
      x: obj.x,
      y: obj.y,
      layers: obj.layers.map(),
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
      name: this.name,
      visible: this.visible,
      lock: this.lock,
      compositeMode: this.compositeMode,
      opacity: this.opacity,
      x: this.x,
      y: this.y,
      layers: this.layers.map((l) => l.serialize()),
    }
  }
}
