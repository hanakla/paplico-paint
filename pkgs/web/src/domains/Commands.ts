import { minOps, operations } from '@fleur/fleur'
import { PapCommands, PapDOMDigger } from '@paplico/core'
import {
  EditorActions,
  EditorOps,
  EditorSelector,
  EditorStore,
} from './EditorStable'

export const CommandOps = operations({
  async convertToGroups(x) {
    const document = EditorSelector.currentDocument(x.getStore)
    const selectedLayers = EditorSelector.selectedLayerUids(x.getStore)

    if (!document || !selectedLayers.length) return

    const groupingLayerPathes = selectedLayers.map((uid) => {
      return PapDOMDigger.getPathToLayer(document, uid, { strict: true })
    })

    console.log({ selectedLayers, groupingLayerPathes })

    x.dispatch(EditorActions.clearLayerSelection, {})

    await x.executeOperation(
      EditorOps.runCommand,
      new PapCommands.Layer.ConvertToGroup({
        groupingLayerPathes,
      })
    )
  },
})
