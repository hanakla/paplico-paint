import { Paplico } from '@paplico/core-new'
import { createRoot } from 'react-dom/client'
import { EditorRoot } from './editors/EditorRoot'
import { StoresContext, createEditorStore, createEngineStore } from './store'
import { themeVariables } from './theme'
import { ToolModes } from './utils/types'
import { bind } from './bind'

export type PaplicoEditorHandle = ReturnType<typeof bindPaplico>

export function bindPaplico(
  attachTarget: HTMLElement,
  paplico: Paplico,
  {
    theme = themeVariables,
  }: {
    theme?: typeof themeVariables
  } = {},
) {
  if (typeof window === 'undefined') {
    throw new Error('bindPaplico must be called in browser environment')
  }

  const engineStore = createEngineStore()
  const editorStore = createEditorStore()

  bind(paplico, engineStore, editorStore)

  const root = createRoot(attachTarget)

  const timeout = setTimeout(() => {
    root.render(
      <StoresContext.Provider
        value={{ editor: editorStore, engine: engineStore }}
      >
        <EditorRoot />
      </StoresContext.Provider>,
    )
  })

  return {
    dispose() {
      clearTimeout(timeout)
      root.unmount()
    },
    currentEditorMode: () => {
      return editorStore.getState().currentType
    },

    setToolMode: (mode: ToolModes) => {
      editorStore.setState({ toolMode: mode })
    },

    /**
     * Set current canvas scale to scaling editor elements scaling.
     * This is not for scaling canvas UI itself.
     * Canvas UI scaling must be control by your application.
     */
    setCanvasScaledScale: (scale: number) => {
      editorStore.setState({ canvasScale: scale })
    },
    showBrushSizePreview: (
      size: number,
      { durationMs = 1000 }: { durationMs?: number } = {},
    ) => {
      editorStore.setState({ brushSizePreview: { size, durationMs } })
    },

    getSelectedObjectIds: () => {
      return Object.keys(editorStore.getState().selectedObjectIds)
    },
    setSelectedObjectIds: (ids: ((prev: string[]) => string[]) | string[]) => {
      const currentIds = Object.keys(editorStore.getState().selectedObjectIds)
      const nextIds = typeof ids === 'function' ? ids(currentIds) : ids

      let nextIdState: Record<string, true> = {}
      for (const id of nextIds) nextIdState[id] = true

      editorStore.setState({
        selectedObjectIds: nextIdState,
      })
    },
  }
}
