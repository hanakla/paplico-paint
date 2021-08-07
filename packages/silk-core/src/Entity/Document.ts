import { LayerTypes } from './index'
import mitt, { Emitter } from 'mitt'
import { ILayer } from './IRenderable'
import { RasterLayer } from './RasterLayer'
import { VectorLayer } from './VectorLayer'
import msgpack from 'msgpack5'

type DocumentEvents = {
  layersChanged: void
}

export class Document {
  public static create({ width, height }: { width: number; height: number }) {
    const document = new Document()
    Object.assign(document, { width, height })

    return document
  }

  public width: number = 0
  public height: number = 0

  public layers: (RasterLayer | VectorLayer)[] = []
  public activeLayerId: string | null = null

  protected mitt: Emitter<DocumentEvents> = mitt()
  public on: Emitter<DocumentEvents>['on']
  public off: Emitter<DocumentEvents>['off']

  constructor() {
    this.on = this.mitt.on.bind(this.mitt)
    this.off = this.mitt.off.bind(this.mitt)
  }

  public addLayer(
    layer: LayerTypes,
    { aboveLayerId }: { aboveLayerId?: string | null } = {}
  ) {
    if (aboveLayerId == null) {
      this.layers = [layer, ...this.layers]
    }

    const index = this.layers.findIndex((layer) => layer.id == aboveLayerId)
    this.layers.splice(index, 0, layer)
    this.mitt.emit('layersChanged')
  }

  public sortLayer(process: (layers: LayerTypes[]) => LayerTypes[]) {
    this.layers = process(this.layers)
    this.mitt.emit('layersChanged')
  }

  public serialize() {
    return {
      width: this.width,
      height: this.height,
      activeLayerId: this.activeLayerId,
      layers: this.layers.map((layer) => layer.serialize()),
    }
  }

  public toArrayBuffer() {
    const packer = msgpack()
    const buf = packer.encode(this.serialize())
    const ab = new Uint8Array(buf.length)
    ab.set(buf.slice())
    return ab
  }
}
