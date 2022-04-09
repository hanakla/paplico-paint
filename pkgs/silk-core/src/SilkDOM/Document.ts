import { v4 } from 'uuid'

import { LayerTypes } from './index'
import { assign } from '../utils'
import { RasterLayer } from './RasterLayer'
import { VectorLayer } from './VectorLayer'
import { FilterLayer } from './FilterLayer'
import { Emitter } from '../Engine3_Emitter'
import { ISilkDOMElement } from './ISilkDOMElement'
import { RGBColor } from '../Value/Colors/RGBColor'

type DocumentEvents = {
  layersChanged: void
}

export class Document
  extends Emitter<DocumentEvents>
  implements ISilkDOMElement
{
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
      globalColors: Object.entries(obj.globalColors).reduce(
        (a, [uid, color]) => {
          return assign(a, { [uid]: RGBColor.deserialize(color) })
        },
        Object.create(null)
      ),
    })
  }

  public readonly uid: string = v4()
  public title: string = ''
  public width: number = 0
  public height: number = 0

  /** Compositing "next on current" */
  public layers: LayerTypes[] = []
  public activeLayerId: string | null = null
  public globalColors: { [uid: string]: RGBColor } = Object.create(null)

  public update(proc: (doc: this) => void) {
    proc(this)
  }

  public getLayer(q: { byUid: string } | { byName: string }) {
    if ('byUid' in q) return this.layers.find((l) => l.uid === q.byUid)
    if ('byName' in q) return this.layers.find((l) => l.name === q.byName)
  }

  public addLayer(
    layer: LayerTypes,
    { aboveLayerId }: { aboveLayerId?: string | null } = {}
  ) {
    if (aboveLayerId == null) {
      this.layers.unshift(layer)
      return
    }

    const index = this.layers.findIndex((layer) => layer.uid == aboveLayerId)

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

  public getLayerSize(layer: LayerTypes) {
    if (layer.layerType === 'raster') {
      return { width: layer.width, height: layer.height }
    } else if (layer.layerType === 'text') {
      return { width: 1, height: 1 }
    } else {
      return { width: this.width, height: this.height }
    }

    return { width: 0, height: 0 }
  }

  public serialize() {
    return {
      title: this.title,
      width: this.width,
      height: this.height,
      activeLayerId: this.activeLayerId,
      layers: this.layers.map((layer) => layer.serialize()),
      globalColors: Object.entries(this.globalColors).reduce(
        (a, [uid, color]) => {
          return Object.assign(a, { [uid]: color.serialize() })
        },
        Object.create(null)
      ),
    }
  }
}
