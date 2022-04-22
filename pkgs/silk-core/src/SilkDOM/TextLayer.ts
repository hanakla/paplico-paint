import { ILayer, LayerEvents } from './ILayer'
import { v4 } from 'uuid'
import { Filter } from './Filter'
import { assign, deepClone } from '../utils'
import { Emitter } from '../Engine3_Emitter'

type Events = LayerEvents<TextLayer>

export class TextLayer extends Emitter<Events> implements ILayer {
  public static deserialize(obj: any) {
    return assign(new TextLayer(), {
      layerType: obj.layerType,
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
      content: obj.content,
      letterSpacing: obj.letterSpacing,
    })
  }

  public readonly layerType = 'text'

  public readonly uid: string = `textlayer-${v4()}`
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

  public content: TextLayer.Content[] = []
  public letterSpacing: number = 1

  public static create({
    content,
    letterSpacing,
  }: {
    content: TextLayer.Content[]
    letterSpacing: number
  }) {
    return assign(new TextLayer(), {
      content: content,
      letterSpacing: letterSpacing,
    })
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
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
      filters: this.filters.map((f) => f.serialize()),
      content: deepClone(this.content),
      letterSpacing: this.letterSpacing,
    }
  }

  public clone(): this {
    return TextLayer.deserialize(
      assign(this.serialize(), { uid: `textlayer-${v4()}` })
    ) as this
  }
}

export namespace TextLayer {
  export type Content = { content: string }
}
