import { ILayer } from './IRenderable'
import { v4 } from 'uuid'
import { Filter } from './Filter'
import { assign, deepClone } from '../utils'

export class TextLayer implements ILayer {
  public readonly layerType = 'text'

  public readonly id: string = `textlayer-${v4()}`
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

  public update(proc: (layer: TextLayer) => void) {
    proc(this)
  }

  public serialize() {
    return {
      layerType: this.layerType,
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
      filters: this.filters.map((f) => f.serialize()),
      content: deepClone(this.content),
      letterSpacing: this.letterSpacing,
    }
  }
}

export namespace TextLayer {
  export type Content = { content: string }
}
