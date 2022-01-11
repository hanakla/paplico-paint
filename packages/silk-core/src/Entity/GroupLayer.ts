import { CompositeMode, ILayer } from './IRenderable'

export class GroupLayer implements ILayer {
  public readonly layerType = 'group'

  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeMode: CompositeMode = 'normal'
  public opacity: number = 100
  public x: number = 0
  public y: number = 0

  public layers: ILayer[] = []

  public get width() {
    return 0
  }

  public get height() {
    return 0
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
