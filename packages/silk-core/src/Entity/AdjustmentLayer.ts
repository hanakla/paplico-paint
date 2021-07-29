import { ILayer } from './IRenderable'
import {v4} from 'uuid'
import { Effect } from './Effect'

export class AdjustmentLayer implements ILayer {
  public readonly layerType = 'adjustment'

  public readonly id: string = v4()
  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeMode: ILayer['compositeMode'] = 'normal'

  public width: number
  public height: number
  public x: number = 0
  public y: number = 0

  public effects: Effect[] = []

  constructor({width, height}: {width: number, height: number}) {
    this.width = width
    this.height = height
  }
}
