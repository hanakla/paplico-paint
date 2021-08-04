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
}
