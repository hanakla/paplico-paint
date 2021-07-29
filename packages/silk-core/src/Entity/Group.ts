import { IRenderable } from './IRenderable'

export class Group implements IRenderable {
  public readonly layerType = 'group'

  public layers: IRenderable[] = []
}
