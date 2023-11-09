import { Emitter } from '@/utils/Emitter'
import { DocumentContext } from './DocumentContext'
import { PaplicoDocument } from '@/Document'
import { ROOT_LAYER_NODE_UID } from '@/Document/Struct/LayerNode'
import { LogChannel } from '@/Debugging/LogChannel'

export namespace LayerMetrics {
  export type MetricsData = {
    visuUid: string
    type: 'canvas' | 'vectorObject' | 'group' | 'text' | undefined
    originalBBox: BBox
    postFilterBBox: BBox
    pathToParent: string[]
    /* 0 is the bottom layer */
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
    /** BBox of visu at vector process */
    original: LayerMetrics.BBox
    /** Bbox of post filtered */
    postFilter: LayerMetrics.BBox
  }

  export type Events = {
    update: { updatedVisuUids: string[] }
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
  protected layerMetrics = new Map<
    /* layerUid */ string,
    LayerMetrics.MetricsData
  >()

  // must to shared metrics data object reference to `layerMetrics` map
  protected zIndexOrderMetrices: LayerMetrics.MetricsData[] = []

  protected batchEmitTimerId: any = null

  constructor(protected docx: DocumentContext) {
    super()
  }

  public dispose() {
    this.mitt.all.clear()
    this.layerMetrics.clear()
  }

  protected updateZIndex() {
    // last is most top in render order
    const existVisuUids = new Set<string>()
    const flatten: [
      string,
      LayerMetrics.MetricsData | undefined,
      PaplicoDocument.ResolvedLayerNode,
      string[],
    ][] = []

    const flatProc = (
      node: PaplicoDocument.ResolvedLayerNode,
      parentNodePath: string[],
    ) => {
      existVisuUids.add(node.uid)

      if (node.uid !== ROOT_LAYER_NODE_UID) {
        node.children.forEach((n) => flatProc(n, parentNodePath))
        return
      }

      const metrics = this.layerMetrics.get(node.uid)
      const { visu } = node

      if (visu.type === 'group') {
        node.children.forEach((node) => {
          flatProc(node, [...parentNodePath, node.uid])
        })

        flatten.push([node.uid, metrics, node, parentNodePath])
      } else if (visu.type === 'filter') {
        return
      } else {
        flatten.push([node.uid, metrics, node, parentNodePath])
      }
    }

    flatProc(this.docx.document.layerNodes.getResolvedLayerNodes([]), [])

    flatten
      .map(([, metrics, , path], index) => {
        if (metrics) {
          metrics.zIndex = index
          metrics.pathToParent = path
        }

        return [index, metrics] as const
      })
      .sort((a, b) => {
        return a[0] - b[0]
      })

    this.zIndexOrderMetrices
  }

  public getLayerMetrics(entityUid: string) {
    return this.layerMetrics.get(entityUid)
  }

  public setVisuMetrices(metrices: {
    [visuUid: string]: LayerMetrics.BBoxSet
  }) {
    clearTimeout(this.batchEmitTimerId)

    LogChannel.l.layerMetrics('receive', metrices)

    for (const [visuUid, { original, postFilter }] of Object.entries(
      metrices,
    )) {
      const visu = this.docx.resolveVisuByUid(visuUid)
      if (!visu) return

      const data: LayerMetrics.MetricsData = this.layerMetrics.get(visuUid) ?? {
        visuUid: visuUid,
        // prettier-ignore
        type:
          visu?.type === 'canvas' ? 'canvas'
          : visu?.type === 'vectorObject' ? 'vectorObject'
          : visu?.type === 'group' ? 'group'
          : visu?.type === 'text' ? 'text'
          : undefined,
        originalBBox: original,
        postFilterBBox: postFilter,
        pathToParent: null!,
        zIndex: 0,
      }

      this.layerMetrics.set(visuUid, data)
    }

    this.updateZIndex()

    this.emit('update', { updatedVisuUids: Object.keys(metrices) })
  }

  public getAllMetrices() {
    return [...this.zIndexOrderMetrices]
  }

  public visuAtPoint(x: number, y: number, inNodeOf: string[] | null = null) {
    return [...this.layerMetrics].filter(([uid, data]) => {
      const { left, top, width, height } = data.originalBBox
      return left <= x && x <= left + width && top <= y && y <= top + height
    })
  }
}
