import { ILayer, LayerEvents } from './ILayer'
import { v4 } from 'uuid'
import { Filter } from './Filter'
import { assign, deepClone, pick } from '../utils/object'
import { Emitter } from '../Engine3_Emitter'
import * as featureTag from './internal/featureTag'

type Events = LayerEvents<TextLayer>

export declare namespace TextLayer {
  export type Attributes = ILayer.Attributes & {
    content: Content[]
    letterSpacing: number
  }

  export type Content = { content: string }

  export type PatchableAttributes = Omit<
    Attributes,
    'uid' | 'layerType' | 'width' | 'height'
  >
}

export class TextLayer extends Emitter<Events> implements ILayer {
  public static readonly patchableAttributes: readonly (keyof TextLayer.PatchableAttributes)[] =
    Object.freeze([
      'name',
      'visible',
      'lock',
      'compositeMode',
      'opacity',
      'x',
      'y',
      'features',
      'content',
      'letterSpacing',
    ])

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
      features: obj.features,
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
  public readonly filters: Filter[] = []
  public readonly features = Object.create(null)

  public readonly content: TextLayer.Content[] = []
  public readonly letterSpacing: number = 1

  public static create(attrs: TextLayer.PatchableAttributes) {
    return assign(new TextLayer(), pick(attrs, TextLayer.patchableAttributes))
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
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
      filters: this.filters.map((f) => f.serialize()),
      features: this.features,
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
