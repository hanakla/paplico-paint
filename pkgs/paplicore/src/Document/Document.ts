import { v4 } from 'uuid'
import { deepClone } from '../utils/object'
import { LayerEntity } from './LayerEntity'
import { LayerNode } from './LayerNode'
import { PaplicoBlob } from './PaplicoBlob'

export namespace PaplicoDocument {
  export type Meta = {
    schemaVersion: '2'
    title: string
  }
}

export class PaplicoDocument {
  public static deserialize() {
    return
  }

  public uid: string = v4()
  public meta: PaplicoDocument.Meta = {
    schemaVersion: '2',
    title: '',
  }

  public layerEntites: LayerEntity[] = []
  public layerTree: LayerNode[] = []
  public blobs: PaplicoBlob[] = []

  public resolveLayerEntity(layerId: string) {
    return this.layerEntites.find((layer) => layer.uid === layerId)
  }

  public serialize() {
    return deepClone({
      uid: this.uid,
      meta: this.meta,
      layerEntites: this.layerEntites,
      layerTree: this.layerTree,
      blobs: this.blobs,
    })
  }
}
