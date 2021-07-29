import { IRenderable } from './IRenderable'

export class Layer implements IRenderable {
  public readonly layerType = 'raster'
  public readonly bitmap: Uint8ClampedArray
}
