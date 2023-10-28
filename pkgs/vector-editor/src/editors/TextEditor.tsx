import { useEditorStore, useEngineStore } from '@/store'
import { memo, useCallback, useEffect, useMemo, useReducer } from 'react'
import { PathObject } from './VectorEditor/PathObject'

type Props = {
  width: number
  height: number
}

export const VectorEditor = memo(function VectorEditor({
  width,
  height,
}: Props) {
  const { paplico, state: engineState } = useEngineStore()
  const editorStore = useEditorStore()
  const rerender = useReducer((x) => x + 1, 0)[1]

  const layer = useMemo(() => {
    if (!engineState.activeLayer?.layerUid) return null

    const entity = paplico.currentDocument?.resolveLayerEntity(
      engineState.activeLayer.layerUid,
    )
    if (entity?.layerType !== 'text') return null

    return entity
  }, [engineState.activeLayer?.layerUid])

  const handleClickRoot = useCallback(() => {
    editorStore.setSelectedObjectIds(() => ({}))
  }, [])

  useEffect(() => {
    paplico.on('history:affect', ({ layerIds }) => {
      if (!layerIds.includes(engineState.activeLayer?.layerUid ?? '')) return
      rerender()
    })
  })

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        fill: 'transparent',
        outline: 'none',
        pointerEvents: 'none',
        // engineState.activeLayer?.layerType === 'vector' ? 'none' : 'none',
      }}
      tabIndex={-1}
      id="--paplico-vector-editor-vector"
    ></svg>
  )
})
