import { ILayer } from './IRenderable'
import { RasterLayer } from './RasterLayer'
import { VectorLayer } from './VectorLayer'

export class Document {
  public width: number
  public height: number

  public layers: (RasterLayer| VectorLayer)[] = []
  public activeLayerId: string | null = null

  constructor({ width, height }: { width: number; height: number }) {
    this.width = width
    this.height = height
  }

  public addLayer(layer: RasterLayer, {aboveLayerId}: { aboveLayerId?: string | null} = {}) {
    if (aboveLayerId ==null) {
      this.layers = [layer, ...this.layers]
    }

    const index = this.layers.findIndex(layer => layer.id == aboveLayerId)
    this.layers.splice(index, 0, layer)
  }
}
