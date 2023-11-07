import { Paplico } from '@paplico/core-new'
import { EngineStore } from './stores/engine'
import { EditorStore, layerTypeToEditorType } from './stores/editor'
import { StoreApi } from 'zustand'
import { RasterToolModes, VectorToolModes } from './stores/types'
import { Emitter } from 'mitt'
import { PapEditorEvents } from '.'

export function bind(
  paplico: Paplico,
  engineStore: StoreApi<EngineStore>,
  editorStore: StoreApi<EditorStore>,
  emitterStore: Emitter<PapEditorEvents>,
  settings: {
    draggingThreadholdRealPixels: number
  },
) {
  engineStore.getState()._setPaplicoInstance(paplico)
  engineStore.getState()._setEngineState(paplico.state)
  engineStore.getState().set({ busyState: paplico.state.busy })

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
  }

  {
    editorStore.setState({
      draggingThreadholdRealPixels: settings.draggingThreadholdRealPixels,
    })
  }

  paplico.on('stateChanged', ({ busy, ...state }) => {
    engineStore.setState((prv) => ({ state, busyState: busy }))
  })

  paplico.on('strokingTargetChanged', ({ current }) => {
    editorStore.setState({
      strokingTarget: current,
    })
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
  //       rasterToolMode !== RasterToolModes.stroking &&
  //       rasterToolMode !== RasterToolModes.erasing
  //     ) {
  //       e.preventDefault()
  //     }
  //   } else if (layerType === 'vector') {
  //     if (vectorToolMode !== VectorToolModes.stroking) {
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
