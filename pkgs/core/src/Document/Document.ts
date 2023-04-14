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
    return assign(new PaplicoDocument(), {
      uid: data.uid,
      meta: data.meta,
      layerEntities: data.layersEntities,
      layerTree: data.layerTree,
      blobs: data.blobs,
    })
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
  public layerTree: LayerNode[] = []
  public blobs: PaplicoBlob[] = []

  public constructor({ width, height }: { width: number; height: number }) {
    this.meta.mainArtboard = { width, height }
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
      blobs: this.blobs,
    })
  }
}
