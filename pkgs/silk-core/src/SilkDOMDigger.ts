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
import { ReferenceLayer } from 'SilkDOM/ReferenceLayer'

// prettier-ignore
type FilterLayerType<K extends LayerTypes['layerType']> =
  K extends 'raster' ? RasterLayer
  : K extends 'vector' ? VectorLayer
  : K extends 'filter' ? FilterLayer
  : K extends 'group' ? GroupLayer
  : K extends 'reference' ? ReferenceLayer
  : LayerTypes

interface Digger {
  // prettier-ignore
  findLayer<K extends LayerTypes['layerType'], S extends boolean | undefined>(
    document: { layers: readonly LayerTypes[] },
    path: readonly string[],
    query?: { kind?: K, strict?: S }
  ): FilterLayerType<K> | (S extends true ? never : null)

  findLayerParent(
    document: Document,
    path: readonly string[]
  ): Document | GroupLayer

  findLayerRecursive<
    K extends LayerTypes['layerType'],
    S extends boolean | undefined
  >(
    document: { layers: readonly LayerTypes[] },
    layerUid: string,
    query?: { kind?: K; strict?: S }
  ): FilterLayerType<K> | (S extends true ? never : null)

  findObjectInLayer<S extends boolean | undefined>(
    document: { layers: readonly LayerTypes[] },
    path: readonly string[],
    objectUid: string,
    option?: { strict?: S }
  ): VectorObject | (S extends true ? never : Nullish)

  getPathToLayer<S extends boolean | undefined>(
    document: { layers: readonly LayerTypes[] },
    layerUid: string,
    query?: { strict: S }
  ): string[] | (S extends true ? Nullish : never)

  traverseLayers<K extends LayerTypes['layerType']>(
    document: { layers: readonly LayerTypes[] },
    query: { kind?: K },
    proc: (l: FilterLayerType<K>) => void | { stop: true }
  ): void
}

export const SilkDOMDigger: Digger = {
  findLayer: (document, path, { kind, strict } = {}) => {
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
  findLayerParent: (document, path) => {
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
  findLayerRecursive(document, uid, { kind, strict } = {}) {
    let target: LayerTypes | Nullish = null

    SilkDOMDigger.traverseLayers(document, {}, (layer) => {
      if (layer.uid === uid && (kind == null || layer.layerType === kind)) {
        target = layer
        return { stop: true }
      }
    })

    if (target == null && strict)
      throw new Error(`Layer not found (in recursive): ${uid}`)

    return target as any
  },
  traverseLayers(document, { kind } = {}, proc) {
    const traverse = (layers: readonly LayerTypes[]) => {
      for (const layer of layers) {
        if (kind != null && layer.layerType !== kind) continue

        const result = proc(layer as any)
        if (result?.stop) return

        if ('layers' in layer) traverse(layer.layers)
      }
    }

    traverse(document.layers)
  },

  getPathToLayer(document, uid, { strict }) {
    const traverse = (
      layers: readonly LayerTypes[],
      current: string[] = []
    ) => {
      for (const layer of layers) {
        if (layer.uid === uid) return [...current, layer.uid]
        if ('layers' in layer) traverse(layer.layers, [...current, layer.uid])
      }

      return null
    }

    const path = traverse(document.layers)
    if (strict && path == null)
      throw new Error(`Layer not found (in getPathToLayer): ${uid}`)

    return path as any
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
