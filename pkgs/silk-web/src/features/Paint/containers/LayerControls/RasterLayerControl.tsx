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
    <>
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
    </>
  )
}
