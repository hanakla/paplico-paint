import { ILayer } from './IRenderable'
import {v4} from 'uuid'

export class VectorLayer implements ILayer {
  public readonly layerType = 'vector'

  public readonly id: string = v4()
  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeMode: ILayer['compositeMode'] = 'normal'

  public width: number
  public height: number
  public x: number = 0
  public y: number = 0

  public readonly paths: any[] = []
}
