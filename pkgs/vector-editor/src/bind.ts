import { Paplico } from '@paplico/core-new'
import { EngineStore } from './stores/engine'
import { EditorStore } from './stores/editor'
import { StoreApi } from 'zustand'
import { ToolModes } from './utils/types'

export function bind(
  paplico: Paplico,
  engineStore: StoreApi<EngineStore>,
  editorStore: StoreApi<EditorStore>,
) {
  engineStore.getState()._setPaplicoInstance(paplico)
  engineStore.getState()._setEngineState(paplico.state)
  editorStore.setState({
    currentType:
      paplico.activeLayer?.layerType === 'vector' ? 'vector' : 'none',
  })

  paplico.on('stateChanged', (state) => {
    engineStore.getState()._setEngineState(state)
  })

  paplico.on('documentChanged', ({ current }) => {
    const layerType = paplico.activeLayer?.layerType

    editorStore.setState(() => ({
      enabled: layerType === 'vector' || layerType === 'raster',
      currentType:
        // prettier-ignore
        layerType === 'vector' ? 'vector'
        : layerType === 'text' ? 'text'
        : 'none',
    }))
  })

  const cancelStroke = (e: Paplico.StrokeEvent) => {
    const layerType = paplico.activeLayer?.layerType
    const toolMode = editorStore.getState().toolMode

    if (layerType === 'raster') {
      if (toolMode !== ToolModes.brush) e.preventDefault()
    } else if (layerType === 'vector') {
      if (toolMode !== ToolModes.brush) e.preventDefault()
    } else {
      e.preventDefault()
    }
  }

  paplico.on('strokePreChange', cancelStroke)
  paplico.on('strokePreComplete', cancelStroke)

  paplico.on('activeLayerChanged', ({ current }) => {
    const layerType = paplico.activeLayer?.layerType

    editorStore.setState(() => ({
      enabled: current?.layerType === 'vector',
      currentType: layerType === 'vector' ? 'vector' : 'none',
    }))
  })
}
