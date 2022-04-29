import { useStore } from '@fleur/react'
import { DOMRectReadOnly } from 'use-measure'
import { EditorSelector } from '🙌/domains/EditorStable'
import { VectorLayerControl } from './LayerControls/VectorLayerControl'
import { RasterLayerControl } from './LayerControls/RasterLayerControl'
import { TextLayerControl } from './LayerControls/TextLayerControl'
import { GroupLayerControl } from './LayerControls/GroupLayerControl'

export const ControlsOverlay = ({
  editorBound,
}: {
  editorBound: DOMRectReadOnly
}) => {
  const {
    activeLayer,
    currentDocument,
    canvasScale,
    canvasPosition: { x, y },
  } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    currentDocument: EditorSelector.currentDocument(get),
    canvasScale: EditorSelector.canvasScale(get),
    canvasPosition: EditorSelector.canvasPosition(get),
  }))

  // const bbox = currentLayerBBox ?? { width: 0, height: 0 }

  if (!currentDocument) return null

  return (
    <svg
      // Match to Canvas bounding in Editor bounding
      data-devmemo="Canvas bounding svg"
      width={currentDocument.width * canvasScale}
      height={currentDocument.height * canvasScale}
      viewBox={`0 0 ${currentDocument.width} ${currentDocument.height}`}
      x={editorBound.width / 2 - (currentDocument.width * canvasScale) / 2}
      y={editorBound.height / 2 - (currentDocument.height * canvasScale) / 2}
      overflow="visible"
    >
      <g
        data-devmemo="Canvas transform group"
        transform={`rotate(0) translate(${x} ${y})`}
        origin="center"
      >
        {activeLayer?.layerType === 'raster' && <RasterLayerControl />}
        {activeLayer?.layerType === 'group' && <GroupLayerControl />}
        {activeLayer?.layerType === 'vector' && <VectorLayerControl />}
        {activeLayer?.layerType === 'text' && <TextLayerControl />}
      </g>
    </svg>
  )
}
