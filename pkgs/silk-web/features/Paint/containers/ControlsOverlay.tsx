import { useFleurContext, useStore } from '@fleur/react'
import { Fragment, MouseEvent, useMemo, useRef, useState } from 'react'
import { createEditor, Descendant } from 'slate'
import { Slate, Editable, withReact } from 'slate-react'
import { SilkDOM } from 'silk-core'
import { deepClone } from '🙌/utils/clone'
import { assign } from '🙌/utils/assign'
import { useMouseTrap } from '🙌/hooks/useMouseTrap'
import { rgba } from 'polished'
import { any } from '🙌/utils/anyOf'
import { SilkWebMath } from '🙌/utils/SilkWebMath'
import { DOMRectReadOnly } from 'use-measure'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useFunk } from '@hanakla/arma'
import { isEventIgnoringTarget } from '../helpers'
import { VectorLayerControl } from './LayerControls/VectorLayerControl'
import { RasterLayerControl } from './LayerControls/RasterLayerControl'
import { TextLayerControl } from './LayerControls/TextLayerControl'

export const ControlsOverlay = ({
  editorBound,
  className,
}: {
  editorBound: DOMRectReadOnly
  className?: string
}) => {
  const {
    activeLayer,
    currentLayerBBox,
    currentDocument,
    canvasScale,
    canvasPosition: { x, y },
  } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    currentLayerBBox: EditorSelector.activeLayerBBox(get),
    currentDocument: EditorSelector.currentDocument(get),
    canvasScale: EditorSelector.canvasScale(get),
    canvasPosition: EditorSelector.canvasPosition(get),
  }))

  const bbox = currentLayerBBox ?? { width: 0, height: 0 }

  if (!currentDocument) return null

  return (
    <svg
      width={editorBound.width}
      height={editorBound.height}
      viewBox={`0 0 ${editorBound.width} ${editorBound.height}`}
      x={editorBound.width / 2 - (currentDocument.width * canvasScale) / 2}
      y={editorBound.height / 2 - (currentDocument.height * canvasScale) / 2}
      className={className}
    >
      <g
        transform={`scale(${canvasScale}) rotate(0deg) translate(${
          x - bbox.width / 2
        }, ${y - bbox.height / 2})`}
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
