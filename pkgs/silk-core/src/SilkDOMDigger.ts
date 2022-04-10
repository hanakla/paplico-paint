import { Nullish } from './utils'
import {
  Document,
  LayerTypes,
  RasterLayer,
  VectorLayer,
  FilterLayer,
  GroupLayer,
  VectorObject,
} from './SilkDOM'

interface Digger {
  // prettier-ignore
  findLayer<K extends LayerTypes['layerType'], S extends boolean | undefined>(
    document: { layers: LayerTypes[] },
    path: string[],
    query?: { kind?: K, strict?: S }
  ): (K extends 'raster' ? RasterLayer
    : K extends 'vector' ? VectorLayer
    : K extends 'filter' ? FilterLayer
    : K extends 'group' ? GroupLayer
    : LayerTypes) | (S extends true ? never : null)
  findLayerParent(document: Document, path: string[]): Document | GroupLayer
  // prettier-ignore
  findObjectInLayer<S extends boolean | undefined>(
    document: { layers: LayerTypes[] },
    path: string[],
    objectUid: string,
    option?: { strict?: S }
  ): VectorObject | (S extends true ? never : Nullish)
}

export const SilkDOMDigger: Digger = {
  findLayer: (
    document: { layers: LayerTypes[] },
    path: string[],
    { kind, strict }: { kind?: string; strict?: boolean } = {}
  ) => {
    const [first, ...parts] = path
    let target: LayerTypes | Nullish = document.layers.find(
      (l) => l.uid === first
    )

    for (const part of parts) {
      if (!target || !('layers' in target)) {
        target = null
        break
      }

      target = target.layers.find((l) => l.uid === part)
    }

    // prettier-ignore
    target = target == null ? null
      : (kind != null && target.layerType !== kind ? null
          : target)

    if (strict && target == null)
      throw new Error(`Layer not found: ${path.join('->')}`)

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
  findObjectInLayer: (document, path, objectUid, { strict } = {}) => {
    const layer = SilkDOMDigger.findLayer(document, path, {
      kind: 'vector',
      strict: true,
    })

    const object = layer.objects.find((o) => o.uid === objectUid)
    if (strict && object == null)
      throw new Error(
        `VectorObject not found: ${path.join('->')}->${objectUid}`
      )

    return object as any
  },
}
