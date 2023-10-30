import { LayerNode } from '@/Document'
import { DocumentContext } from './DocumentContext/DocumentContext'

type RenderTask = {
  source: RenderTargets | { layerUid: string }
  renderTarget: RenderTargets
  exec: (input: CanvasImageSource, output: CanvasRenderingContext2D) => void
}

const RenderTargets = {
  TMP1: 1,
  FILTER_BUF: 2,
  PREDEST: 3,
  DESTINATION: 100,
}
type RenderTargets = (typeof RenderTargets)[keyof typeof RenderTargets]

export function createRenderSchedule(node: LayerNode, ctx: DocumentContext) {
  const tasks: RenderTask[] = []

  for (const child of node.children) {
    const layerRef = ctx.resolveLayer(child.layerUid)
    const layer = layerRef?.source.deref()
    if (!layerRef || !layer) continue

    if (layer.layerType === 'raster') {
      tasks.push({
        source: {
          layerUid: child.layerUid,
        },
        renderTarget: RenderTargets.FILTER_BUF,
        exec: (input, output) => {
          output.drawImage(input, 0, 0)
        },
      })
    }

    layer.filters.forEach((filter) => {})
  }
}
