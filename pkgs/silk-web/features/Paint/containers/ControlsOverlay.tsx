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

export const ControlsOverlay = ({
  editorBound,
  rotate,
  position: { x, y },
  scale,
  className,
}: {
  editorBound: DOMRectReadOnly
  rotate: number
  position: { x: number; y: number }
  scale: number
  className?: string
}) => {
  const { activeLayer, currentLayerBBox, currentDocument } = useStore(
    (get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      currentLayerBBox: EditorSelector.activeLayerBBox(get),
      currentDocument: EditorSelector.currentDocument(get),
    })
  )

  const bbox = currentLayerBBox ?? { width: 0, height: 0 }

  if (!currentDocument) return null

  return (
    <svg
      width={editorBound.width}
      height={editorBound.height}
      viewBox={`0 0 ${editorBound.width} ${editorBound.height}`}
      x={editorBound.width / 2 - (currentDocument.width * scale) / 2}
      y={editorBound.height / 2 - (currentDocument.height * scale) / 2}
    >
      <g
        transform={`scale(${scale}) rotate(${rotate}) translate(${
          x - bbox.width / 2
        }, ${y - bbox.height / 2})`}
      >
        <rect x="0" y="0" width="10" height="10" fill="red" />
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
        {activeLayer?.layerType === 'vector' && (
          <VectorLayerControl scale={scale} />
        )}
        {activeLayer?.layerType === 'text' && <TextLayerControl />}
      </g>
    </svg>
  )
}

const RasterLayerControl = () => {
  const { session, currentDocument } = useStore((get) => ({
    session: EditorSelector.currentSession(get),
    currentDocument: EditorSelector.currentDocument(get),
  }))

  const bbox = session?.currentLayerBBox ?? null

  if (!bbox || !currentDocument) return null

  return (
    <>
      <rect
        css={`
          fill: none;
          stroke: #0ff;
        `}
        x={bbox.x}
        y={bbox.y}
        width={bbox?.width}
        height={bbox?.height}
      />
    </>
  )
}

const TextLayerControl = ({}) => {
  const currentLayerBBox = useStore((get) => EditorSelector.activeLayerBBox)
  const editor = useMemo(() => withReact(createEditor()), [])
  // Add the initial value when setting up our state.
  const [value, setValue] = useState<Descendant[]>([
    {
      type: 'paragraph',
      children: [{ text: 'A line of text in a paragraph.' }],
    },
  ])

  const bbox = currentLayerBBox ?? null

  return (
    <div
      css={`
        position: absolute;
        left: 0;
        top: 0;
        z-index: 1000;
      `}
      style={{
        left: bbox?.x,
        top: bbox?.y,
      }}
    >
      <Slate
        editor={editor}
        value={value}
        onChange={(newValue) => setValue(newValue)}
      >
        <Editable />
      </Slate>
    </div>
  )
}
