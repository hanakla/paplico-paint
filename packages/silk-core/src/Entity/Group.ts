import { ILayer } from './IRenderable'

export class Group implements ILayer {
  public readonly layerType = 'group'

  public layers: ILayer[] = []
}
