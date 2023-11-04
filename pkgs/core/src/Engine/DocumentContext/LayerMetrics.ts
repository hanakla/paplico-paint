import { Emitter } from '@/utils/Emitter'
import { DocumentContext } from './DocumentContext'
import { LayerNode, VectorGroup, VectorObject } from '@/Document'

export namespace LayerMetrics {
  export type MetricsData = {
    sourceUid: string
    type: 'raster' | 'vectorObject' | 'vectorGroup' | 'text' | undefined
    sourceBBox: BBox
    visuallyBBox: BBox
    containedLayerUid: string
    // 0 is the bottom layer
    zIndex: number
  }

  export type BBox = {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
    centerX: number
    centerY: number
  }

  export type BBoxSet = {
    source: LayerMetrics.BBox
    visually: LayerMetrics.BBox
  }

  export type Events = {
    update: void
  }
}

export function createEmptyBBox(): LayerMetrics.BBox {
  return {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    centerX: 0,
    centerY: 0,
  }
}

export function createBBox(args: {
  left: number
  top: number
  width: number
  height: number
}): LayerMetrics.BBox {
  return {
    left: args.left,
    top: args.top,
    right: args.left + args.width,
    bottom: args.top + args.height,
    width: args.width,
    height: args.height,
    centerX: args.left + args.width / 2,
    centerY: args.top + args.height / 2,
  }
}

export class LayerMetrics extends Emitter<LayerMetrics.Events> {
  public layerMetrics = new Map<
    /* layerUid */ string,
    LayerMetrics.MetricsData
  >()

  protected batchEmitTimerId: any = null

  constructor(protected doocument: DocumentContext) {
    super()
  }

  public dispose() {
    this.mitt.all.clear()
    this.layerMetrics.clear()
  }

  protected recaluculateZIndex() {
    const flatten: [string, LayerNode | VectorObject | VectorGroup][] = []

    const flatProc = (node: LayerNode | VectorObject | VectorGroup) => {
      if (
        (node as LayerNode).layerUid !== '__root__' &&
        (node as VectorObject | VectorGroup).type !== 'vectorGroup'
      ) {
        flatten.push([
          (node as LayerNode).layerUid ??
            (node as VectorObject | VectorGroup).uid,
          node,
        ])
      }

      if ('type' in node && node.type === 'vectorGroup') {
        node.children.forEach(flatProc)
      } else if ('type' in node && node.type === 'vectorObject') {
      } else {
        const layer = this.doocument.document.resolveLayerEntity(node.layerUid)
        if (layer?.layerType === 'vector') {
          layer.objects.forEach(flatProc)
        }

        node.children.forEach(flatProc)
      }
    }

    flatProc(this.doocument.rootNode)

    flatten.forEach(([id, entity], index) => {
      const data = this.layerMetrics.get(id)
      if (!data) {
        // TODO
        return
      }

      data.zIndex = index
    })

    return flatten
  }

  public getLayerMetrics(entityUid: string) {
    return this.layerMetrics.get(entityUid)
  }

  public setEntityMetrice(
    entityUid: string,
    sourceBBox: LayerMetrics.BBox,
    visuallyBBox: LayerMetrics.BBox,
  ) {
    const layer = this.doocument.resolveLayer(entityUid)?.source.deref()
    const vectorObj = this.doocument.resolveVectorObject(entityUid)

    if (!layer && !vectorObj) return
    if (layer && layer.layerType !== 'raster' && layer.layerType !== 'text')
      return

    clearTimeout(this.batchEmitTimerId)

    const data: LayerMetrics.MetricsData = this.layerMetrics.get(entityUid) ?? {
      sourceUid: entityUid,
      // prettier-ignore
      type:
        layer?.layerType === 'raster' ? 'raster'
        : vectorObj?.type === 'vectorObject' ? 'vectorObject'
        : vectorObj?.type === 'vectorGroup' ? 'vectorGroup'
        : layer?.layerType === 'text' ? 'text'
        : undefined,
      sourceBBox,
      visuallyBBox,
      containedLayerUid: entityUid,
      zIndex: 0,
    }

    if (!sourceBBox) debugger
    data.sourceBBox = sourceBBox
    data.visuallyBBox = visuallyBBox

    this.layerMetrics.set(entityUid, data)
    this.recaluculateZIndex()

    this.batchEmitTimerId = setTimeout(() => {
      this.emit('update')
    }, 10)
  }

  public layerAtPoint(x: number, y: number) {
    return [...this.layerMetrics].filter(([uid, data]) => {
      const { left, top, width, height } = data.sourceBBox
      return left <= x && x <= left + width && top <= y && y <= top + height
    })
  }
}
