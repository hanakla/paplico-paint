import {
  Document,
  LayerTypes,
  RasterLayer,
  VectorLayer,
  FilterLayer,
} from './SilkDOM'

interface Digger {
  findLayer(document: Document, path: string[]): LayerTypes | null
  // prettier-ignore
  findLayer<K extends LayerTypes['layerType']>(
    document: Document,
    path: string[],
    query?: { kind: K }
  ): (K extends 'raster' ? RasterLayer
    : K extends 'vector' ? VectorLayer
    : K extends 'filter' ? FilterLayer
    : never) | null
}

export const DocumentDigger: Digger = {
  findLayer(document: Document, path: string[], { kind = '' } = {}) {
    const layer = document.layers.find((l) => l.uid === path[0])
    if (layer == null) return null
    if (kind != null && layer.layerType !== kind) return null
    return layer as any
  },
}
