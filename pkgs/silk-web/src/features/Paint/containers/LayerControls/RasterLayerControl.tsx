import { useStore } from '@fleur/react'
import { useRef } from 'react'
import { useDrag } from 'react-use-gesture'
import { EditorOps, EditorSelector } from '🙌/domains/EditorStable'
import { DOMUtils } from '🙌/utils/dom'
import { useFleur } from '🙌/utils/hooks'

export const RasterLayerControl = () => {
  const { execute } = useFleur()

  const rootRef = useRef<SVGSVGElement | null>(null)

  const {
    activeLayer,
    activeLayerPath,
    canvasScale,
    currentDocument,
    currentTool,
  } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    activeLayerPath: EditorSelector.activeLayerPath(get),
    canvasScale: EditorSelector.canvasScale(get),
    currentDocument: EditorSelector.currentDocument(get),
    currentTool: EditorSelector.currentTool(get),
  }))

  const bbox = currentDocument?.getLayerSize(activeLayer!) ?? null

  const bindDrag = useDrag(({ xy }) => {
    if (currentTool !== 'cursor') return

    execute(EditorOps.updateRasterLayer, activeLayerPath, (layer) => {
      const point = DOMUtils.domPointToSvgPoint(rootRef.current!, {
        x: xy[0],
        y: xy[1],
      })
      layer.x = point.x
      layer.y = point.y
    })
  })

  if (activeLayer?.layerType !== 'raster' || !bbox || !currentDocument)
    return null

  return (
    <svg
      ref={rootRef}
      data-devmemo="Raster layer control"
      width={currentDocument.width}
      height={currentDocument.height}
      viewBox={`0 0 ${currentDocument.width} ${currentDocument.height}`}
    >
      <rect
        css={`
          fill: none;
          stroke: #0ff;
          stroke-width: 2px;
          pointer-events: visiblePainted;
        `}
        x={activeLayer.x}
        y={activeLayer.x}
        width={bbox?.width}
        height={bbox?.height}
        {...bindDrag()}
      />
    </svg>
  )
}
