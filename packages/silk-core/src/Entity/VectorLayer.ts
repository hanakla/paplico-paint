import { IRenderable } from './IRenderable'

export class VectorLayer implements IRenderable {
  public readonly layerType = 'vector'
  public readonly paths: any[] = []
}
