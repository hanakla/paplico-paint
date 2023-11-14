import { useEditorStore, useEngineStore } from '@/store'
import { unreachable } from '@/utils/unreachable'
import { storePicker } from '@/utils/zustand'
import { memo, useEffect } from 'react'
import { ToolModes } from '..'

export const SyncStoreToPaplico = memo(function SyncStoreToPaplico() {
  const { paplico } = useEngineStore(storePicker(['paplico', 'state']))
  const editor = useEditorStore()

  // Sync brush state
  useEffect(() => {
    paplico.setStrokeCompositionMode(
      // prettier-ignore
      editor.toolMode === ToolModes.none ? 'none'
      : editor.toolMode === ToolModes.ellipseTool ? 'none'
      : editor.toolMode === ToolModes.rectangleTool ? 'none'
      : editor.toolMode === ToolModes.strokingTool ? 'normal'
      : editor.toolMode === ToolModes.eraserTool ? 'erase'
      : editor.toolMode === ToolModes.objectTool ? 'none'
      : editor.toolMode === ToolModes.vectorPenTool ? 'none'
      : editor.toolMode === ToolModes.pointTool ? 'none'
      : 'none',
    )
  }, [editor.toolMode])

  return null
})
