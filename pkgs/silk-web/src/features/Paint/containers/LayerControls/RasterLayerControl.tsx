import { useStore } from '@fleur/react'
import { EditorSelector } from '🙌/domains/EditorStable'

export const RasterLayerControl = () => {
  const { activeLayer, canvasScale, currentDocument } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    canvasScale: EditorSelector.canvasScale(get),
    currentDocument: EditorSelector.currentDocument(get),
  }))

  const bbox = currentDocument?.getLayerSize(activeLayer!) ?? null

  if (activeLayer?.layerType !== 'raster' || !bbox || !currentDocument)
    return null

  return (
    <svg
      data-devmemo="Raster layer control"
      width={currentDocument.width}
      height={currentDocument.height}
      viewBox={`0 0 ${currentDocument.width} ${currentDocument.height}`}
    >
      <rect
        css={`
          fill: none;
          stroke: #0ff;
        `}
        x={activeLayer.x}
        y={activeLayer.x}
        width={bbox?.width}
        height={bbox?.height}
      />
    </svg>
  )
}
