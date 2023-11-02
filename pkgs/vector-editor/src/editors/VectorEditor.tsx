import { useEditorStore, useEngineStore } from '@/store'
import { memo, useCallback, useEffect, useMemo, useReducer } from 'react'
import { PathObject } from './VectorEditor/PathObject'
import { RectReadOnly } from 'react-use-measure'
import { storePicker } from '@/utils/zutrand'
import { ShapeTools } from './VectorEditor/ShapeTools'
import { isShapeToolMode } from '@/stores/editor'

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
  const editorStore = useEditorStore(
    storePicker(['setSelectedObjectIds', 'toolMode']),
  )
  const rerender = useReducer((x) => x + 1, 0)[1]

  const layer = useMemo(() => {
    if (!paplico.activeLayer?.layerUid) return null

    const entity = paplico.currentDocument?.resolveLayerEntity(
      paplico.activeLayer.layerUid,
    )
    if (entity?.layerType !== 'vector') return null

    return entity
  }, [paplico.activeLayer?.layerUid])

  const handleClickRoot = useCallback(() => {
    editorStore.setSelectedObjectIds(() => ({}))
  }, [])

  useEffect(() => {
    paplico.on('history:affect', ({ layerIds }) => {
      if (!layerIds.includes(paplico.activeLayer?.layerUid ?? '')) return
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

      {isShapeToolMode(editorStore.toolMode) && (
        <ShapeTools width={width} height={height} />
      )}

      {layer?.objects.map((object) => (
        <PathObject key={object.uid} layerUid={layer.uid} object={object} />
      ))}
    </svg>
  )
})
