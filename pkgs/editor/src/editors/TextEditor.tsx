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
    if (!editorStore.strokingTarget?.visuUid) return null

    const entity = paplico.currentDocument?.getVisuByUid(
      editorStore.strokingTarget.visuUid,
    )
    if (entity?.type !== 'text') return null

    return entity
  }, [editorStore.strokingTarget?.visuUid])

  const metrics = useMemo(() => {
    if (!layer?.uid) return null
    paplico.runtimeDoc?.layerMetrics.getLayerMetrics(layer!.uid)
  }, [layer?.uid])

  const handleClickRoot = useCallback(() => {
    editorStore.setSelectedVisuUids(() => ({}))
  }, [])

  useEffect(() => {
    paplico.on('history:affect', ({ layerIds }) => {
      if (!layerIds.includes(editorStore.strokingTarget?.visuUid ?? '')) return
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
        // engineState.activeVisu?.layerType === 'vector' ? 'none' : 'none',
      }}
      tabIndex={-1}
      id="--paplico-vector-editor-text"
    ></svg>
  )
})
