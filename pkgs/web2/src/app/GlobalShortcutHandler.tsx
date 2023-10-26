import { usePaplico } from '@/domains/paplico'
import { useEditorStore } from '@/domains/uiState'
import { useGlobalMousetrap } from '@/utils/hooks'
import { memo } from 'react'

import msgpack from 'msgpack5'
import { letDownload } from '@hanakla/arma'
import { Commands } from '@paplico/core-new'

export const GlobalShortcutHandler = memo(function GlobalShortcutHandler() {
  const { pap, papStore, editorHandle } = usePaplico()
  const { fileHandlers, setFileHandlerForDocument, getShortcuts } =
    useEditorStore()

  const shortcuts = getShortcuts()

  useGlobalMousetrap(shortcuts.global.delete, async () => {
    if (!papStore.activeLayerEntity) return
    const objUIDs = editorHandle!.getSelectedObjectIds()

    pap!.command.do(
      new Commands.VectorUpdateLayer(papStore.activeLayerEntity.uid, {
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
    console.log('hi')

    if (papStore.activeLayerEntity?.layerType !== 'vector') return

    console.log('hi2')

    editorHandle?.setSelectedObjectIds(
      papStore.activeLayerEntity.objects.map((object) => object.uid),
    )
  })

  useGlobalMousetrap(shortcuts.global.unselectAll, () => {
    editorHandle?.setSelectedObjectIds([])
  })

  return null
})
