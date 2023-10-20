import { ulid } from '@/utils/ulid'
import { assign, deepClone } from '@/utils/object'
import { LayerEntity } from './LayerEntity'
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
    layerTree: LayerNode[]
    blobs: PaplicoBlob[]
  }
}

export class PaplicoDocument {
  public static deserialize(data: PaplicoDocument.SerializedSchema) {
    return assign(
      new PaplicoDocument({
        width: data.meta.mainArtboard.width,
        height: data.meta.mainArtboard.height
      }),
      {
        uid: data.uid,
        meta: data.meta,
        layerEntities: data.layersEntities,
        layerTree: data.layerTree,
        blobs: data.blobs
      }
    )
  }

  public uid: string = ulid()
  public meta: PaplicoDocument.Meta = {
    schemaVersion: '2',
    title: '',
    mainArtboard: {
      width: 100,
      height: 100
    }
  }

  public layerEntities: LayerEntity[] = []
  public layerTree: LayerNode[] = []
  public blobs: PaplicoBlob[] = []

  public constructor({ width, height }: { width: number; height: number }) {
    this.meta.mainArtboard = { width, height }
  }

  public addLayer(
    layer: LayerEntity,
    [...nodePosition]: readonly number[] = [-1]
  ) {
    this.layerEntities.push(layer)

    let parent: LayerNode[] = this.layerTree
    let placePosition = nodePosition.pop()

    if (placePosition == null) {
      throw new Error(
        `Document.addLayer: layer inserstion position (last element of nodePosition) is not specified`
      )
    }

    for (const pos of nodePosition) {
      parent = parent[pos].children
    }

    if (placePosition === -1) {
      parent.push({ layerUid: layer.uid, children: [] })
    } else {
      parent.splice(placePosition, 0, { layerUid: layer.uid, children: [] })
    }
  }

  public resolveLayerEntity(layerId: string) {
    return this.layerEntities.find((layer) => layer.uid === layerId)
  }

  public serialize(): PaplicoDocument.SerializedSchema {
    return deepClone({
      uid: this.uid,
      meta: this.meta,
      layersEntities: this.layerEntities,
      layerTree: this.layerTree,
      blobs: this.blobs
    })
  }
}
