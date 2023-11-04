import { useEditorStore, useEngineStore } from '@/store'
import { storePicker } from '@/utils/zutrand'
import { memo, useEffect } from 'react'

export const SyncStoreToPaplico = memo(function SyncStoreToPaplico() {
  const { paplico } = useEngineStore(storePicker(['paplico', 'state']))
  const editor = useEditorStore()

  // Sync brush state
  useEffect(() => {
    paplico.setStrokeCompositionMode(
      // prettier-ignore
      editor.editorType === 'vector'
        ? editor.vectorToolMode === 'stroking' ? 'normal'
        : 'none'
      : editor.editorType === 'raster'
        ? editor.rasterToolMode === 'stroking' ? 'none'
        : editor.rasterToolMode === 'erasing' ? 'erase'
        : 'none'
      : 'none',
    )
  }, [paplico.activeLayer, editor.vectorToolMode, editor.rasterToolMode])

  return null
})
