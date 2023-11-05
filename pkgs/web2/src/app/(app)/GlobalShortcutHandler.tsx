import { usePaplicoInstance, useEngineStore } from '@/domains/paplico'
import { useEditorStore } from '@/domains/uiState'
import { useGlobalMousetrap } from '@/utils/hooks'
import { memo, use } from 'react'

import msgpack from 'msgpack5'
import { letDownload } from '@hanakla/arma'
import { Commands } from '@paplico/core-new'
import { storePicker } from '@/utils/zutrand'
import { RasterToolModes, VectorToolModes } from '@paplico/editor'

export const GlobalShortcutHandler = memo(function GlobalShortcutHandler() {
  const { pplc: pap, editorHandle } = usePaplicoInstance()
  const papStore = useEngineStore(storePicker(['strokeTargetVisually']))

  const { fileHandlers, setFileHandlerForDocument, getShortcuts } =
    useEditorStore()

  const shortcuts = getShortcuts()

  useGlobalMousetrap(shortcuts.global.delete, async () => {
    if (!papStore.strokeTargetVisually) return
    const objUIDs = editorHandle!.getSelectedObjectIds()

    pap!.command.do(
      new Commands.VectorUpdateLayer(papStore.strokeTargetVisually.uid, {
        updater: (layer) => {
          layer.objects = layer.objects.filter(
            (object) => !objUIDs.includes(object.uid),
          )
        },
      }),
    )
  })

  useGlobalMousetrap(shortcuts.global.save, async () => {
    if (!pap?.currentDocument) return

    const doc = pap.currentDocument.serialize()

    const handler =
      fileHandlers[doc.uid] ?? typeof window.showSaveFilePicker !== 'undefined'
        ? await window.showSaveFilePicker({
            types: [
              {
                description: 'Paplico project',
                accept: { 'application/octet-stream': '.paplic' },
              },
            ],
          })
        : null

    if (handler) {
      setFileHandlerForDocument(doc.uid, handler)
    }

    const packer = msgpack()
    const bin = packer.encode({ doc, papEditor: {} }) as unknown as Uint8Array
    const blob = new Blob([bin], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)

    if (handler) {
      await (
        await handler.createWritable({ keepExistingData: false })
      ).write(blob)
    } else {
      letDownload(url, 'test.paplic')
    }
  })

  useGlobalMousetrap(shortcuts.global.undo, () => {
    pap?.command.undo()
  })

  useGlobalMousetrap(shortcuts.global.redo, () => {
    pap?.command.redo()
  })

  useGlobalMousetrap(shortcuts.global.selectAll, () => {
    if (papStore.strokeTargetVisually?.layerType !== 'vector') return

    editorHandle?.setSelectedObjectIds(
      papStore.strokeTargetVisually.objects.map((object) => object.uid),
    )
  })

  useGlobalMousetrap(shortcuts.global.unselectAll, () => {
    editorHandle?.setSelectedObjectIds([])
  })

  useGlobalMousetrap(shortcuts.global.brushTool, () => {
    editorHandle?.setRasterToolMode(RasterToolModes.stroking)
    editorHandle?.setVectorToolMode(VectorToolModes.stroking)
  })

  useGlobalMousetrap(shortcuts.global.vectorShapeRectTool, () => {
    editorHandle?.setVectorToolMode(VectorToolModes.rectangleTool)
  })

  useGlobalMousetrap(shortcuts.global.vectorEllipseTool, () => {
    editorHandle?.setVectorToolMode(VectorToolModes.ellipseTool)
  })

  useGlobalMousetrap(shortcuts.global.vectorObjectTool, () => {
    editorHandle?.setVectorToolMode(VectorToolModes.objectTool)
  })

  useGlobalMousetrap(shortcuts.global.vectorPointTool, () => {
    editorHandle?.setVectorToolMode(VectorToolModes.pointTool)
  })

  return null
})
