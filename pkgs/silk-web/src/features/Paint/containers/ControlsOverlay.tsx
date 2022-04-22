import { useStore } from '@fleur/react'
import { DOMRectReadOnly } from 'use-measure'
import { EditorSelector } from '🙌/domains/EditorStable'
import { VectorLayerControl } from './LayerControls/VectorLayerControl'
import { RasterLayerControl } from './LayerControls/RasterLayerControl'
import { TextLayerControl } from './LayerControls/TextLayerControl'

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
        {/* {activeLayer?.layerType === 'raster' && bbox && (
          // <div
          //   css={`
          //     position: absolute;
          //     z-index: 1;
          //     border: 1px solid #0ff;
          //   `}
          //   style={{
          //     top: bbox.y,
          //     left: bbox.x,
          //     width: bbox.width,
          //     height: bbox.height,
          //   }}
          // />
          <rect
            x={bbox.x}
            y={bbox.y}
            width={bbox.width}
            height={bbox.height}
            stroke="#0ff"
          />
        )} */}
        {activeLayer?.layerType === 'raster' && <RasterLayerControl />}
        {activeLayer?.layerType === 'vector' && <VectorLayerControl />}
        {activeLayer?.layerType === 'text' && <TextLayerControl />}
      </g>
    </svg>
  )
}
