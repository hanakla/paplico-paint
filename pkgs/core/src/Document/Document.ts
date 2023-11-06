import { ulid } from '@/utils/ulid'
import { assign, deepClone } from '@/utils/object'
import { LayerNode } from './LayerNode'
import { PaplicoBlob } from './PaplicoBlob'
import { VisuElement } from './Visually'
import { createGroupVisually } from './Visually/factory'
import { createNodesController } from './Document.LayerNodes'

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
    visues: VisuElement.AnyElement[]
    layerTree: LayerNode
    blobs: PaplicoBlob[]
  }

  export type ResolvedLayerNode = {
    /** uid for Visually */
    uid: string
    visu: VisuElement.AnyElement
    children: ResolvedLayerNode[]
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
        visuElements: data.visues,
        layerTreeRoot: data.layerTree,
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

  public readonly visuElements: VisuElement.AnyElement[] = []
  public readonly layerTreeRoot: LayerNode = {
    visuUid: '__root__',
    children: [],
  }
  public readonly blobs: PaplicoBlob[] = []

  public constructor({ width, height }: { width: number; height: number }) {
    this.meta.mainArtboard = { width, height }
  }

  public dispose() {
    this.blobs.splice(0)
  }

  public readonly layerNodes = createNodesController(this)

  /**
   * Get Visually instance combined layer nodes which under of pointed node by `path`
   * @param path
   * @returns instance
   */
  public getResolvedLayerTree(
    path: string[],
  ): PaplicoDocument.ResolvedLayerNode {
    const node = this.layerNodes.getNodeAtPath(path)

    if (!node)
      throw new Error(`PaplicoDocument.getResolvedLayerTree: node not found`)

    const layer = this.getVisuByUid(node.visuUid)
    if (!layer)
      throw new Error(`PaplicoDocument.getResolvedLayerTree: Visu not found`)

    return {
      uid: node.visuUid,
      visu: layer,
      children: node.children.map((child) => {
        return this.getResolvedLayerTree([...path, child.visuUid])
      }),
    }
  }

  public getVisuByUid(visuallyUid: string): VisuElement.AnyElement | undefined {
    if (visuallyUid === '__root__') {
      const vis = createGroupVisually({})
      vis.uid = '__root__'
      return vis
    }

    return this.visuElements.find((layer) => layer.uid === visuallyUid)
  }

  public isStrokeableVisu(
    visu: VisuElement.AnyElement,
  ): visu is VisuElement.CanvasElement | VisuElement.GroupElement {
    return visu.type === 'canvas' || visu.type === 'group'
  }

  public isChildrenContainableVisu(
    visu: VisuElement.AnyElement,
  ): visu is VisuElement.GroupElement {
    return visu.type === 'group'
  }

  /** @deprecated */
  public resolveVectorObject(
    uid: string,
  ): VisuElement.VectorObjectElement | null {
    return (
      this.visuElements.find(
        (v): v is VisuElement.VectorObjectElement =>
          v.type === 'vectorObject' && v.uid === uid,
      ) ?? null
    )
  }

  public serialize(): PaplicoDocument.SerializedSchema {
    return deepClone({
      uid: this.uid,
      meta: this.meta,
      visues: this.visuElements,
      layerTree: this.layerTreeRoot,
      blobs: this.blobs,
    })
  }
}
