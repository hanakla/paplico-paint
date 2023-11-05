import { Paplico } from '@paplico/core-new'
import { createRoot } from 'react-dom/client'
import { EditorRoot } from './editors/EditorRoot'
import { StoresContext, createEditorStore, createEngineStore } from './store'
import { themeVariables } from './theme'
import { EditorTypes, RasterToolModes, VectorToolModes } from './stores/types'
import { bind } from './bind'
import { createEmitterStore } from './stores/emittter'
import { SyncStoreToPaplico } from './editors/SyncStoreToPaplico'
export { EditorTypes, VectorToolModes, RasterToolModes } from './stores/types'

export type PapEditorHandle = ReturnType<typeof bindPaplico>
export type PapEditorEvents = {
  editorTypeChanged: { prev: EditorTypes; next: EditorTypes }
  vectorToolModeChanged: { prev: VectorToolModes; next: VectorToolModes }
  rasterToolModeChanged: { prev: RasterToolModes; next: RasterToolModes }
  objectSelectionChanged: { selectedObjectIds: string[] }
}

export function bindPaplico(
  attachTarget: HTMLElement,
  paplico: Paplico,
  {
    theme = themeVariables,
    draggingThreadholdRealPixels = 4,
  }: {
    theme?: typeof themeVariables
    draggingThreadholdRealPixels?: number
  } = {},
) {
  if (typeof window === 'undefined') {
    throw new Error('bindPaplico must be called in browser environment')
  }

  const engineStore = createEngineStore()
  const editorStore = createEditorStore()
  const emitterStore = createEmitterStore()

  bind(paplico, engineStore, editorStore, emitterStore, {
    draggingThreadholdRealPixels,
  })

  const root = createRoot(attachTarget)

  root.render(
    <StoresContext.Provider
      value={{
        editor: editorStore,
        engine: engineStore,
        emitter: emitterStore,
      }}>
      <SyncStoreToPaplico />
      <EditorRoot />
    </StoresContext.Provider>,
  )

  return {
    dispose() {
      root.unmount()
    },

    currentEditorMode: () => {
      return editorStore.getState().editorType
    },

    getRasterToolMode: () => {
      return editorStore.getState().rasterToolMode
    },
    setRasterToolMode: (
      mode: RasterToolModes,
      ignoreEditorTypeForce?: boolean,
    ) => {
      if (
        !ignoreEditorTypeForce &&
        editorStore.getState().editorType !== 'raster'
      )
        return

      emitterStore.emit('rasterToolModeChanged', {
        prev: editorStore.getState().rasterToolMode,
        next: mode,
      })

      editorStore.setState({ rasterToolMode: mode })
    },

    getVectorToolMode: () => {
      return editorStore.getState().vectorToolMode
    },

    setVectorToolMode: (
      mode: VectorToolModes,
      ignoreEditorTypeForce?: boolean,
    ) => {
      if (
        !ignoreEditorTypeForce &&
        editorStore.getState().editorType !== 'vector'
      ) {
        return
      }

      emitterStore.emit('vectorToolModeChanged', {
        prev: editorStore.getState().vectorToolMode,
        next: mode,
      })
      editorStore.setState({ vectorToolMode: mode })
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

      emitterStore.emit('objectSelectionChanged', {
        selectedObjectIds: nextIds,
      })

      editorStore.setState({
        selectedObjectIds: nextIdState,
      })
    },

    setBrushToSelectedObjects: (brushSetting: Paplico.BrushSetting) => {
      const ids = editorStore.getState().selectedObjectIds

      for (const id of Object.keys(ids)) {
        paplico.currentDocument?.resolveVectorObject
      }
    },

    on<K extends keyof PapEditorEvents>(
      type: K,
      callback: (payload: PapEditorEvents[K]) => void,
    ): () => void {
      emitterStore.on(type, callback)
      return () => emitterStore.off(type, callback)
    },
    off<K extends keyof PapEditorEvents>(
      type: K,
      callback: (payload: PapEditorEvents[K]) => void,
    ): void {
      emitterStore.off(type, callback)
    },

    subscribeEditorState: (callback: () => void) => {
      const unsubscribe = editorStore.subscribe(() => {
        callback()
      })

      return unsubscribe
    },
  }
}
