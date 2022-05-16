import { LayerTypes } from '../../DOM'

export class ListConnector {
  public type = 'layerlist'

  public layers = []

  appendChild(layer: LayerTypes) {
    this.layers.push(layer)
  }
}
