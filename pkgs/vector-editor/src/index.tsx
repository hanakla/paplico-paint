import { Paplico } from '@paplico/core-new'
import { createRoot } from 'react-dom/client'
import { EditorRoot } from './editors/EditorRoot'
import { StoresContext, createEditorStore, createEngineStore } from './store'
import { themeVariables } from './theme'
import { createUseStyles } from 'react-jss'
import { memo } from 'react'

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

  engineStore.getState()._setPaplicoInstance(paplico)
  engineStore.getState()._setEngineState(paplico.state)

  paplico.on('stateChanged', (state) => {
    engineStore.getState()._setEngineState(state)
  })

  paplico.on('documentChanged', ({ current }) => {
    editorStore.setState(() => ({
      enabled: paplico.state.activeLayer?.layerType === 'vector',
    }))
  })

  paplico.on('activeLayerChanged', ({ current }) => {
    editorStore.setState(() => ({
      enabled: current?.layerType === 'vector',
    }))
  })

  const root = createRoot(attachTarget)
  root.render(
    <StoresContext.Provider
      value={{ editor: editorStore, engine: engineStore }}
    >
      <EditorRoot />
    </StoresContext.Provider>,
  )

  return {
    /**
     * Set current canvas scale to scaling editor elements scaling.
     * This is not for scaling canvas UI itself.
     * Canvas UI scaling must be control by your application.
     */
    setCanvasScaledScale: (scale: number) => {
      editorStore.setState({ canvasScale: scale })
    },
  }
}
