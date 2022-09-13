import { Nullish } from './utils'
import {
  Document,
  LayerTypes,
  RasterLayer,
  VectorLayer,
  FilterLayer,
  GroupLayer,
  VectorObject,
  TextLayer,
  ReferenceLayer,
  Filter,
} from './DOM'

// prettier-ignore
type FilterLayerType<K extends LayerTypes['layerType']> =
  K extends 'raster' ? RasterLayer
  : K extends 'vector' ? VectorLayer
  : K extends 'filter' ? FilterLayer
  : K extends 'group' ? GroupLayer
  : K extends 'reference' ? ReferenceLayer
  : K extends 'text' ? TextLayer
  : LayerTypes

interface Digger {
  // prettier-ignore
  findLayer<K extends LayerTypes['layerType'], S extends boolean | undefined>(
    document: { layers: readonly LayerTypes[] },
    path: readonly string[],
    query?: { kind?: K | Array<K>, strict?: S }
  ): FilterLayerType<K> | (S extends true ? never : null)

  findLayerParent<S extends boolean | undefined>(
    document: Document,
    pathOrLayerUid: readonly string[] | string,
    option?: { strict?: S }
  ): (Document | GroupLayer) | (S extends true ? never : null)

  findLayerRecursive<
    K extends LayerTypes['layerType'],
    S extends boolean | undefined
  >(
    document: { layers: readonly LayerTypes[] },
    layerUid: string,
    query?: { kind?: K | Array<K>; strict?: S }
  ): FilterLayerType<K> | (S extends true ? never : null)

  findObjectInLayer<S extends boolean | undefined>(
    document: { layers: readonly LayerTypes[] },
    path: readonly string[],
    objectUid: string,
    option?: { strict?: S }
  ): VectorObject | (S extends true ? never : Nullish)

  findObjectInThisLayer<S extends boolean | undefined>(
    layer: VectorLayer,
    objectUid: string,
    option?: { strict?: S }
  ):
    | { index: number; object: VectorObject }
    | (S extends true ? never : Nullish)

  findObjectDeeplyInLayer<S extends boolean | undefined>(
    document: { layers: readonly LayerTypes[] },
    path: readonly string[],
    objectUid: string,
    option?: { strict?: S }
  ):
    | {
        path: string
        closestParent: VectorObject | null
        indexInClosestParent: number
        object: VectorObject
      }
    | (S extends true ? never : Nullish)

  findParentLayers<S extends boolean | undefined>(
    document: { layers: readonly LayerTypes[] },
    layerUid: string,
    { strict }: { strict?: S }
  ):
    | { path: string[]; parent: Document | GroupLayer; layers: LayerTypes[] }
    | (S extends true ? never : null)

  getPathToLayer<S extends boolean | undefined>(
    document: { layers: readonly LayerTypes[] },
    layerUid: string,
    query?: { strict?: S }
  ): string[] | (S extends true ? never : Nullish)

  traverseLayers<K extends LayerTypes['layerType']>(
    document: { layers: readonly LayerTypes[] },
    query: { kind?: K | Array<K> },
    proc: (l: FilterLayerType<K>, path: string[]) => void | { stop: true }
  ): void

  findFilter<S extends boolean | undefined>(
    document: { layers: readonly LayerTypes[] },
    path: readonly string[],
    filterUid: string,
    query?: { strict?: S; filterId?: string }
  ): Filter | (S extends true ? never : null)
}

const matchLayerType = <K extends LayerTypes['layerType']>(
  layerType: LayerTypes['layerType'],
  kind: K | Array<K>
) => {
  const normKind = Array.isArray(kind) ? kind : [kind]
  return normKind.includes(layerType as any)
}

export const PapDOMDigger: Digger = {
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
      : kind != null && !matchLayerType(target.layerType, kind) ? null
      : target

    if (strict && target == null)
      throw new Error(`Layer not found: ${path.join('->')}`)

    return target as any
  },
  findLayerParent: (document, pathOrLayerUid, { strict } = {}) => {
    let prev: Document | GroupLayer | null = document
    let parent: any = null

    if (typeof pathOrLayerUid === 'string') {
      const pathToLayer = PapDOMDigger.getPathToLayer(
        document,
        pathOrLayerUid,
        {
          strict,
        }
      )

      if (!pathToLayer) return null

      pathOrLayerUid = pathToLayer
    }

    for (const part of pathOrLayerUid) {
      const layer: LayerTypes | undefined = prev?.layers.find(
        (l) => l.uid === part
      )

      if (!layer) {
        parent = null
        break
      }

      parent = prev
      prev = 'layers' in layer ? layer : null
    }

    if (parent == null) {
      if (strict)
        throw new Error(`Layer not found: ${pathOrLayerUid.join('->')}`)
    }

    return parent as any
  },
  findLayerRecursive(document, uid, { kind, strict } = {}) {
    let target: LayerTypes | Nullish = null

    PapDOMDigger.traverseLayers(document, { kind }, (layer) => {
      if (layer.uid === uid) {
        target = layer
        return { stop: true }
      }
    })

    if (target == null && strict)
      throw new Error(`Layer not found (in recursive): ${uid}`)

    return target as any
  },
  traverseLayers(document, { kind } = {}, proc) {
    const traverse = (
      layers: readonly LayerTypes[],
      currentPath: string[] = []
    ) => {
      for (const layer of layers) {
        if (kind != null && !matchLayerType(layer.layerType, kind)) continue

        const result = proc(layer as any, [...currentPath, layer.uid])
        if (result?.stop) return

        if ('layers' in layer)
          traverse(layer.layers, [...currentPath, layer.uid])
      }
    }

    traverse(document.layers)
  },

  getPathToLayer(document, uid, { strict } = {}) {
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
    const layer = PapDOMDigger.findLayer(document, path, {
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

  findObjectInThisLayer(layer, objectUid, { strict } = {}) {
    const index = layer.objects.findIndex((o) => o.uid === objectUid)

    if (index === -1) {
      if (strict)
        throw new Error(`VectorObject not found in ${layer.uid}: ${objectUid}`)
      else return null
    }

    return { index, object: layer.objects[index] } as any
  },

  findObjectDeeplyInLayer: (document, path, objectUid, { strict } = {}) => {
    const traverse = (
      object: VectorObject,
      callback: (
        o: VectorObject,
        path: string[],
        parent: VectorObject | null
      ) => boolean | void,
      currentPath: string[] = [],
      parent: VectorObject | null = null
    ) => {
      const result = callback(object, currentPath, parent)
      if (result != null) return result

      currentPath = [...currentPath, ...object.uid]

      for (const o of object.objects) {
        if (traverse(o, callback, currentPath, o) === false) return
      }
    }

    const layer = PapDOMDigger.findLayer(document, path, {
      kind: 'vector',
      strict: true,
    })

    let parentObject: VectorObject | null = null
    let object: VectorObject | null = null
    let objectPath: string[] | null = null

    for (const obj of layer.objects) {
      traverse(obj, (o, path, parent) => {
        if (o.uid === objectUid) {
          object = o
          objectPath = path
          parentObject = parent
          return false
        }
      })
    }

    if (strict && object == null) {
      throw new Error(
        `VectorObject not found: ${path.join('->')}->${objectUid}`
      )
    }

    return {
      object,
      closestParent: parentObject as VectorObject | null,
      path: objectPath as unknown as string[],
      indexInClosestParent: (
        parentObject as VectorObject | null
      )?.objects.findIndex((o) => o.uid === objectUid),
    } as any
  },

  findParentLayers(document, layerUid, { strict } = {}) {
    const traverse = (
      container: Document | GroupLayer,
      current: string[] = [],
      layers: LayerTypes[] = []
    ): {
      path: string[]
      parent: Document | GroupLayer
      layers: LayerTypes[]
    } | null => {
      for (const l of container.layers) {
        if (l.uid === layerUid)
          return { path: current, parent: container, layers }

        if ('layers' in l) {
          let result = traverse(l, [...current, l.uid], [...layers, l])
          if (result) return result
        }
      }

      return null
    }

    const result = traverse(document as Document)

    if (strict && result == null)
      throw new Error(`Layer not found (in findParentLayers): ${layerUid}`)

    return result as any
  },

  findFilter(document, path, filterUid, { strict, filterId } = {}) {
    const layer = PapDOMDigger.findLayer(document, path, { strict })
    const filter = layer?.filters.find(
      (f) =>
        f.uid === filterUid &&
        (filterId != null ? f.filterId === filterId : true)
    )

    if (strict && filter == null)
      throw new Error(
        `Filter not found: ${path.join('->')}->filter: ${filterUid}`
      )

    return filter as any
  },
}
