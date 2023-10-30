import { useEditorStore, useEngineStore } from '@/store'
import { memo, useCallback, useEffect, useMemo, useReducer } from 'react'

type Props = {
  width: number
  height: number
}

export const TextEditor = memo(function TextEditor({ width, height }: Props) {
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

  const metrics = useMemo(() => {
    if (!layer?.uid) return null
    paplico.runtimeDoc?.layerMetrics.getLayerMetrics(layer!.uid)
  }, [layer?.uid])

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
      id="--paplico-vector-editor-text"
    ></svg>
  )
})
