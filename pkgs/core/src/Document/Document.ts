import { ulid } from '@/utils/ulid'
import { assign, deepClone } from '@/utils/object'
import { LayerEntity, RootLayer } from './LayerEntity'
import { LayerNode } from './LayerNode'
import { PaplicoBlob } from './PaplicoBlob'

export namespace PaplicoDocument {
  export type Meta = {
    schemaVersion: '2'
    title: string
    mainArtboard: {
      width: number
      height: number
    }
  }

  export type SerializedSchema = {
    uid: string
    meta: Meta
    layersEntities: LayerEntity[]
    layerTree: LayerNode
    blobs: PaplicoBlob[]
  }
}

export class PaplicoDocument {
  public static deserialize(data: PaplicoDocument.SerializedSchema) {
    return assign(
      new PaplicoDocument({
        width: data.meta.mainArtboard.width,
        height: data.meta.mainArtboard.height,
      }),
      {
        uid: data.uid,
        meta: data.meta,
        layerEntities: data.layersEntities,
        layerTree: data.layerTree,
        blobs: data.blobs,
      },
    )
  }

  public uid: string = ulid()
  public meta: PaplicoDocument.Meta = {
    schemaVersion: '2',
    title: '',
    mainArtboard: {
      width: 100,
      height: 100,
    },
  }

  public layerEntities: LayerEntity[] = []
  public layerTree: LayerNode = { layerUid: '__root__', children: [] }
  public blobs: PaplicoBlob[] = []

  public constructor({ width, height }: { width: number; height: number }) {
    this.meta.mainArtboard = { width, height }
  }

  public addLayer(
    layer: LayerEntity,
    pathToParent: readonly string[] = [],
    positionInNode: number = -1,
  ) {
    if (this.layerEntities.find((l) => l.uid === layer.uid)) {
      console.warn(
        `Document.addLayer: Layer already exists (uid: ${layer.uid})`,
      )
      return
    }

    this.layerEntities.push(layer)

    const parent = this.resolveNodePath(pathToParent)
    if (!parent) {
      throw new Error(
        `Document.addLayer: Parent node not found (uid: ${pathToParent.join(
          ' > ',
        )})`,
      )
    }

    if (positionInNode === -1) {
      parent?.children.push({ layerUid: layer.uid, children: [] })
    } else {
      parent?.children.splice(positionInNode, 0, {
        layerUid: layer.uid,
        children: [],
      })
    }
  }

  public removeLayer(layerId: string) {
    const path = this.findLayerNodePath(layerId)
    const node = this.resolveNodePath(path!)
    if (!path || !node) return null

    const layer = this.layerEntities.find((l) => l.uid === layerId)
    if (!layer) return null

    this.layerEntities = this.layerEntities.filter((l) => l.uid !== layerId)

    const parentPath = path.slice(0, -1)
    const parent = this.resolveNodePath(parentPath)
    if (!parent) throw new Error('WHATTT?????????')

    parent.children = parent.children.filter(
      (child) => child.layerUid !== layerId,
    )

    return { layer, node }
  }

  public resolveLayerEntity(layerId: string): LayerEntity | undefined {
    if (layerId === '__root__') {
      return {
        layerType: 'root',
        uid: '__root__',
        name: 'root',
        compositeMode: 'normal',
        features: {},
        filters: [],
        lock: false,
        opacity: 1,
        visible: true,
      } satisfies RootLayer
    }

    return this.layerEntities.find((layer) => layer.uid === layerId)
  }

  public resolveNodePath(path: readonly string[]) {
    if (path.length === 0) return this.layerTree
    if (path[0] === '__root__') path = path.slice(1)

    let cursor = this.layerTree
    let target: LayerNode | null = null

    for (const uid of path) {
      let result = cursor.children.find((layer) => layer.layerUid === uid)
      if (!result) break
      if (result.layerUid === uid) {
        target = result
        break
      }
      cursor = result
    }

    if (!target) {
      return null
    }

    return target
  }

  public findLayerNodePath(layerId: string): string[] | null {
    if (layerId === '__root__') return ['__root__']

    const path: string[] = []
    const digNodes = (node: LayerNode): boolean => {
      for (const child of node.children) {
        if (child.layerUid === layerId) {
          path.unshift(child.layerUid)
          return true
        }

        if (digNodes(child)) {
          path.unshift(child.layerUid)
          return true
        }
      }

      return false
    }

    if (digNodes(this.layerTree)) {
      return path
    }

    return null
  }

  public serialize(): PaplicoDocument.SerializedSchema {
    return deepClone({
      uid: this.uid,
      meta: this.meta,
      layersEntities: this.layerEntities,
      layerTree: this.layerTree,
      blobs: this.blobs,
    })
  }
}
