import { ILayer } from './IRenderable'
import {v4} from 'uuid'

export class RasterLayer implements ILayer {
  public readonly layerType = 'raster'

  public readonly id: string = v4()
  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeMode: ILayer['compositeMode'] = 'normal' as const

  public width: number
  public height: number
  public x: number = 0
  public y: number = 0

  public readonly bitmap: Uint8ClampedArray

  constructor({width, height}: {width: number, height: number}) {
    this.bitmap = new Uint8ClampedArray(width * height * 4)
    this.width = width
    this.height = height
  }
}
