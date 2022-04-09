import {
  Document,
  LayerTypes,
  RasterLayer,
  VectorLayer,
  FilterLayer,
  GroupLayer,
} from './SilkDOM'

interface Digger {
  findLayer(
    document: { layers: LayerTypes[] },
    path: string[]
  ): LayerTypes | null
  // prettier-ignore
  findLayer<K extends LayerTypes['layerType']>(
    document: { layers: LayerTypes[] },
    path: string[],
    query?: { kind: K }
  ): (K extends 'raster' ? RasterLayer
    : K extends 'vector' ? VectorLayer
    : K extends 'filter' ? FilterLayer
    : K extends 'group' ? GroupLayer
    : never) | null
  findLayerParent(document: Document, path: string[]): Document | GroupLayer
}

export const SilkDOMDigger: Digger = {
  findLayer: (
    document: { layers: LayerTypes[] },
    path: string[],
    { kind }: { kind?: string } = {}
  ) => {
    const [first, ...parts] = path
    let target = document.layers.find((l) => l.uid === first)

    for (const part of parts) {
      if (!target || !('layers' in target)) return null
      target = target.layers.find((l) => l.uid === part)
    }

    if (target == null) return null
    if (kind != null && target.layerType !== kind) return null
    return target as any
  },
  findLayerParent: (document: Document, path: string[]) => {
    let prev: Document | GroupLayer | null = document
    let parent: any = null
    // let target = document.layers.find((l) => l.uid === first)

    for (const part of path) {
      const layer: LayerTypes | undefined = prev?.layers.find(
        (l) => l.uid === part
      )
      if (!layer) return null

      parent = prev
      prev = 'layers' in layer ? layer : null
    }

    if (parent == null) return null
    return parent as any
  },
}
