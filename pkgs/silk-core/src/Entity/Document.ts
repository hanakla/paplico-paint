import { LayerTypes } from './index'
import { assign } from '../utils'
import { RasterLayer } from './RasterLayer'
import { VectorLayer } from './VectorLayer'
import { FilterLayer } from './FilterLayer'
import { Emitter } from '../engine/Engine3_Emitter'

type DocumentEvents = {
  layersChanged: void
}

export class Document extends Emitter<DocumentEvents> {
  public static create({ width, height }: { width: number; height: number }) {
    const document = new Document()
    assign(document, { width, height })

    return document
  }

  public static deserialize(obj: any) {
    return assign(new Document(), {
      width: obj.width,
      height: obj.height,
      activeLayerId: obj.activeLayerId,
      layers: obj.layers.map((layer: any) => {
        switch (layer.layerType as LayerTypes['layerType']) {
          case 'raster':
            return RasterLayer.deserialize(layer)
          case 'vector':
            return VectorLayer.deserialize(layer)
          case 'filter':
            return FilterLayer.deserialize(layer)
          default:
            throw new Error(
              `Deserialization failed, unexpected layerType ${layer.layerType}`
            )
        }
      }),
    })
  }

  public title: string = ''
  public width: number = 0
  public height: number = 0

  public layers: LayerTypes[] = []
  public activeLayerId: string | null = null

  public addLayer(
    layer: LayerTypes,
    { aboveLayerId }: { aboveLayerId?: string | null } = {}
  ) {
    if (aboveLayerId == null) {
      this.layers.unshift(layer)
      return
    }

    const index = this.layers.findIndex((layer) => layer.id == aboveLayerId)

    if (index === -1) {
      this.layers.push(layer)
    } else {
      this.layers.splice(index, 0, layer)
    }

    this.emit('layersChanged')
  }

  public sortLayer(process: (layers: LayerTypes[]) => LayerTypes[]) {
    this.layers = process(this.layers)
    this.emit('layersChanged')
  }

  public serialize() {
    return {
      title: this.title,
      width: this.width,
      height: this.height,
      activeLayerId: this.activeLayerId,
      layers: this.layers.map((layer) => layer.serialize()),
    }
  }

  public toArrayBuffer() {}
}
