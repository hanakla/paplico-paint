import {
  Document,
  Paplico,
  PplcBrush,
  PplcFilter,
  PplcInk,
} from '@paplico/core-new'
import { createRoot } from 'react-dom/client'
import { EditorRoot } from './editors/EditorRoot'
import { StoresContext, createEditorStore, createEngineStore } from './store'
import { themeVariables } from './theme'
import { EditorTypes, ToolModes } from './stores/types'
import { bind } from './bind'
import { createEmitterStore } from './stores/emittter'
import { SyncStoreToPaplico } from './editors/SyncStoreToPaplico'
import { MutableRefObject, createRef } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { ErrorFallback } from './editors/ErrorFallback'
export { EditorTypes, ToolModes } from './stores/types'

export type PapEditorHandle = ReturnType<typeof bindPaplico>
export type PapEditorEvents = {
  editorTypeChanged: { prev: EditorTypes; next: EditorTypes }
  toolModeChanged: { prev: ToolModes; next: ToolModes }
  objectSelectionChanged: { selectedObjectIds: string[] }
}

export function bindPaplico(
  attachTarget: HTMLElement,
  canvas: HTMLCanvasElement,
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
  const canvasRef: MutableRefObject<HTMLCanvasElement> = { current: canvas }

  root.render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <StoresContext.Provider
        value={{
          editor: editorStore,
          engine: engineStore,
          emitter: emitterStore,
        }}
      >
        <SyncStoreToPaplico />
        <EditorRoot
        // canvasRef={canvasRef}
        />
      </StoresContext.Provider>
      ,
    </ErrorBoundary>,
  )

  return {
    dispose() {
      root.unmount()
    },

    get paplico() {
      return paplico
    },

    get command() {
      return paplico.command
    },

    get currentDocument() {
      return paplico.currentDocument
    },

    get availableBrushes(): readonly PplcBrush.BrushClass[] {
      return paplico.brushes.entries
    },

    get avaibleInks(): readonly PplcInk.InkClass[] {
      return paplico.inks.entries
    },

    get availableFilters(): PplcFilter.FilterClass[] {
      return paplico.filters.entries
    },

    loadDocument: (doc: Document.PaplicoDocument) => {
      paplico.loadDocument(doc)
    },

    getStrokingTarget: () => {
      return paplico.getStrokingTarget()
    },

    setStrokingTarget: (nodePath: string[]) => {
      paplico.setStrokingTarget(nodePath)
    },

    currentEditorMode: () => {
      return editorStore.getState().editorType
    },

    getToolMode: () => {
      return editorStore.getState().toolMode
    },

    setToolMode: (mode: ToolModes) => {
      emitterStore.emit('toolModeChanged', {
        prev: editorStore.getState().toolMode,
        next: mode,
      })

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

    getSelectedVisuUids: () => {
      return Object.keys(editorStore.getState().selectedVisuUids)
    },
    setSelectedVisuUids: (ids: ((prev: string[]) => string[]) | string[]) => {
      const currentIds = Object.keys(editorStore.getState().selectedVisuUids)
      const nextIds = typeof ids === 'function' ? ids(currentIds) : ids

      let nextIdState: Record<string, true> = {}
      for (const id of nextIds) nextIdState[id] = true

      emitterStore.emit('objectSelectionChanged', {
        selectedObjectIds: nextIds,
      })

      editorStore.setState({
        selectedVisuUids: nextIdState,
      })
    },

    setBrushToSelectedObjects: (brushSetting: Paplico.BrushSetting) => {
      const ids = editorStore.getState().selectedVisuUids

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
