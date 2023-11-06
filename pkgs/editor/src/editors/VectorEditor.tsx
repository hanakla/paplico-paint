import { useEditorStore, useEngineStore } from '@/store'
import { memo, useCallback, useEffect, useMemo, useReducer } from 'react'
import { ObjectPathOrGroup } from './VectorEditor/ObjectPath'
import { RectReadOnly } from 'react-use-measure'
import { storePicker } from '@/utils/zustand'
import { ShapeTools } from './VectorEditor/ShapeTools'
import { isVectorShapeToolMode } from '@/stores/editor'

type Props = {
  width: number
  height: number
  rootBBox: RectReadOnly
}

export const VectorEditor = memo(function VectorEditor({
  width,
  height,
}: Props) {
  const { paplico } = useEngineStore(storePicker(['paplico']))
  const editorStore = useEditorStore()
  const rerender = useReducer((x) => x + 1, 0)[1]

  const strokingTarget = paplico.activeVisu

  const layerNode = useMemo(() => {
    if (!strokingTarget) return null
    return paplico.currentDocument?.layerNodes.getNodeAtPath(
      strokingTarget.nodePath,
    )
  }, [strokingTarget?.visuUid])

  const handleClickRoot = useCallback(() => {
    editorStore.setSelectedVisuUids(() => ({}))
  }, [])

  useEffect(() => {
    return paplico.on('history:affect', ({ layerIds }) => {
      if (!layerIds.includes(paplico.activeVisu?.visuUid ?? '')) return
      rerender()
    })
  })

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        fill: 'none',
        outline: 'none',
        pointerEvents: 'none',
      }}
      tabIndex={-1}
      id="--paplico-vector-editor-vector"
    >
      {/* Layer outline */}
      <rect
        width={width}
        height={height}
        x={0}
        y={0}
        onClick={handleClickRoot}
        stroke="#0ff"
        strokeWidth={2}
        style={{
          pointerEvents: 'stroke',
        }}
      />

      {isVectorShapeToolMode(editorStore.vectorToolMode) && (
        <ShapeTools width={width} height={height} />
      )}

      {layerNode?.children.map((node) => (
        <ObjectPathOrGroup key={node.visuUid} visuUid={node.visuUid} />
      ))}
    </svg>
  )
})
