import { Paplico } from '@paplico/core-new'
import { EngineStore } from './stores/engine'
import { EditorStore, layerTypeToEditorType } from './stores/editor'
import { StoreApi } from 'zustand'
import { Emitter } from 'mitt'
import { PplcEditorEvents } from '.'

export function bind(
  paplico: Paplico,
  engineStore: StoreApi<EngineStore>,
  editorStore: StoreApi<EditorStore>,
  emitterStore: Emitter<PplcEditorEvents>,
  settings: {
    draggingThreadholdRealPixels: number
  },
) {
  engineStore.getState()._setPaplicoInstance(paplico)
  engineStore.getState()._setEngineState(paplico.state)
  engineStore.getState().set({ busyState: paplico.state.busy })

  // Editor type handling by stroking target
  {
    const currentEditorType = editorStore.getState().editorType
    const nextEditorType = layerTypeToEditorType(paplico.activeVisu?.visuType)

    if (currentEditorType !== nextEditorType) {
      emitterStore.emit('editorTypeChanged', {
        prev: currentEditorType,
        next: nextEditorType,
      })
    }

    editorStore.setState({
      editorType: nextEditorType,
    })

    paplico.on('strokingTargetChanged', ({ current }) => {
      editorStore.setState({
        strokingTarget: current,
      })
    })
  }

  // Copy registered entries change for dedbup rendering views
  {
    engineStore.setState({
      availableBrushes: paplico.brushes.entries,
      availableInks: paplico.inks.entries,
      availableFilters: paplico.filters.entries,
    })

    paplico.filters.on('entriesChanged', () => {
      engineStore.setState({
        availableFilters: paplico.filters.entries,
      })
    })

    paplico.inks.on('entriesChanged', () => {
      engineStore.setState({
        availableInks: paplico.inks.entries,
      })
    })

    paplico.brushes.on('entriesChanged', () => {
      engineStore.setState({
        availableBrushes: paplico.brushes.entries,
      })
    })
  }

  editorStore.setState({
    draggingThreadholdRealPixels: settings.draggingThreadholdRealPixels,
  })

  paplico.on('stateChanged', ({ busy, ...state }) => {
    engineStore.setState((prv) => ({ state, busyState: busy }))
  })

  paplico.on('documentChanged', ({ current }) => {
    const visuType = paplico.getStrokingTarget()?.visuType
    const nextEditorType = layerTypeToEditorType(visuType)

    emitterStore.emit('editorTypeChanged', {
      prev: editorStore.getState().editorType,
      next: nextEditorType,
    })

    editorStore.setState(() => ({
      enabled: visuType === 'group' || visuType === 'canvas',
      editorType: nextEditorType,
    }))
  })

  // const cancelStrokeIfNeeded = (e: Paplico.StrokeEvent) => {
  //   const layerType = paplico.activeVisu?.layerType
  //   const { vectorToolMode, rasterToolMode } = editorStore.getState()

  //   if (layerType === 'raster') {
  //     if (
  //       rasterToolMode !== RasterToolModes.strokingTool &&
  //       rasterToolMode !== RasterToolModes.erasing
  //     ) {
  //       e.preventDefault()
  //     }
  //   } else if (layerType === 'vector') {
  //     if (vectorToolMode !== VectorToolModes.strokingTool) {
  //       e.preventDefault()
  //     }
  //   } else {
  //     e.preventDefault()
  //   }
  // }

  // paplico.on('strokePreChange', cancelStrokeIfNeeded)
  // paplico.on('strokePreComplete', cancelStrokeIfNeeded)

  paplico.on('strokingTargetChanged', ({ current }) => {
    const layerType = paplico.activeVisu?.visuType
    const nextEditorType = layerTypeToEditorType(layerType)

    emitterStore.emit('editorTypeChanged', {
      prev: editorStore.getState().editorType,
      next: nextEditorType,
    })

    editorStore.setState({ editorType: nextEditorType })
  })
}
