import { v4 } from 'uuid'

import { LayerTypes } from './index'
import { assign } from '../utils/object'
import { Emitter } from '../Engine3_Emitter'
import { ISilkDOMElement } from './ISilkDOMElement'
import { RGBColor } from '../Value/Colors/RGBColor'
import { deserializeLayer } from './desrializeLayer'

type DocumentEvents = {
  layersChanged: void
}

export declare namespace Document {
  export type Attributes = {
    uid: string
    title: string
    width: number
    height: number
    // layers:
    activeLayerPath: string[] | null
  }

  export type SerializedAttributes = Attributes & {
    layers: ReturnType<LayerTypes['serialize']>[]
    globalColors: Record<string, RGBColor>
  }
}

export class Document
  extends Emitter<DocumentEvents>
  implements ISilkDOMElement, Document.Attributes
{
  public static create({ width, height }: { width: number; height: number }) {
    const document = new Document()
    assign(document, { width, height })

    return document
  }

  public static deserialize(obj: Document.SerializedAttributes) {
    return assign(new Document(), {
      uid: obj.uid,
      title: obj.title,
      width: obj.width,
      height: obj.height,
      activeLayerPath: obj.activeLayerPath,
      layers: obj.layers.map((layer: any) => deserializeLayer(layer)),
      globalColors: Object.entries(obj.globalColors).reduce(
        (a, [uid, color]) => {
          return assign(a, { [uid]: { ...color } })
        },
        Object.create(null)
      ),
    })
  }

  public readonly uid: string = v4()
  public title: string = ''
  public width: number = 0
  public height: number = 0

  /** Compositing first to last (last is foreground) */
  public layers: LayerTypes[] = []
  public activeLayerPath: string[] | null = null
  public globalColors: { [uid: string]: RGBColor } = Object.create(null)

  public update(proc: (doc: this) => void) {
    const prevLength = this.layers.length

    proc(this)

    if (prevLength !== this.layers.length) this.emit('layersChanged')
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
  }

  public serialize(): Document.SerializedAttributes {
    return {
      uid: this.uid,
      title: this.title,
      width: this.width,
      height: this.height,
      activeLayerPath: this.activeLayerPath,
      layers: this.layers.map((layer) => layer.serialize()),
      globalColors: Object.entries(this.globalColors).reduce(
        (a, [uid, color]) => {
          return Object.assign(a, { [uid]: { ...color } })
        },
        Object.create(null)
      ),
    }
  }
}
