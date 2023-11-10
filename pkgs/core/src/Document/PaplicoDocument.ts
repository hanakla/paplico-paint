import { ulid } from '@/utils/ulid'
import { assign, deepClone } from '@paplico/shared-lib'
import { LayerNode } from './Struct/LayerNode'
import { PaplicoBlob } from './PaplicoBlob'
import { VisuElement } from './Visually/VisuElement'
import { createGroupVisually } from './Visually/factory'
import { createNodesController } from './PaplicoDocument.LayerNodes'

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
    path: string[]
    children: ResolvedLayerNode[]
  }
}

export class PaplicoDocument {
  public static deserialize(data: PaplicoDocument.SerializedSchema) {
    const doc = assign(
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

    doc.indexingVisues()

    return doc
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

  /**
   * it for performance reason cache for finding visu
   * Source of truth is `visuElements`
   */
  protected readonly visuByIdMap: Record<string, VisuElement.AnyElement> = {}

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

  public getVisuByUid(visuUid: string): VisuElement.AnyElement | undefined {
    if (visuUid === '__root__') {
      const vis = createGroupVisually({})
      vis.uid = '__root__'
      return vis
    }

    let v: VisuElement.AnyElement | undefined = this.visuByIdMap[visuUid]
    if (v) return v

    v = this.visuElements.find((layer) => layer.uid === visuUid)
    if (v) this.visuByIdMap[visuUid] = v

    return v
  }

  public isDrawableVisu(
    visu: VisuElement.AnyElement,
  ): visu is VisuElement.CanvasElement | VisuElement.GroupElement {
    return visu.type === 'canvas' || visu.type === 'group'
  }

  public isChildContainableVisu(
    visu: VisuElement.AnyElement,
  ): visu is VisuElement.GroupElement {
    return visu.type === 'group'
  }

  protected indexingVisues() {
    for (const visu of this.visuElements) {
      this.visuByIdMap[visu.uid] = visu
    }
  }

  /** Internal usage only */
  public __internal_AddLayerNode(
    visu: VisuElement.AnyElement,
    pathToParent: string[],
    positionInNode: number,
  ) {
    this.layerNodes.addLayerNode(visu, pathToParent, positionInNode)
    this.visuByIdMap[visu.uid] = visu
  }

  public __internal_RemoveLayerNode(path: string[]) {
    this.layerNodes.removeLayerNode(path)
    delete this.visuByIdMap[path[path.length - 1]]
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
