import { usePaplicoInstance } from '@/domains/engine'
import { useEditorStore } from '@/domains/uiState'
import { useGlobalMousetrap } from '@/utils/hooks'
import { memo, use } from 'react'

import msgpack from 'msgpack5'
import { letDownload } from '@hanakla/arma'
import { Commands } from '@paplico/core-new'
import { ToolModes } from '@paplico/editor'
import { useNotifyStore } from '@/domains/notifications'

export const GlobalShortcutHandler = memo(function GlobalShortcutHandler() {
  const { pplc: pap, canvasEditor: editorHandle } = usePaplicoInstance()
  const notifyStore = useNotifyStore()

  const { fileHandlers, setFileHandlerForDocument, getShortcuts } =
    useEditorStore()

  const shortcuts = getShortcuts()

  // useGlobalMousetrap(shortcuts.global.delete, async () => {
  //   const currentDocument = editorHandle?.currentDocument
  //   if (!currentDocument) return

  //   const visuUids = editorHandle!.getSelectedVisuUids()
  //   const removePaths = visuUids.map(
  //     (uid) => currentDocument.layerNodes.findNodePathByVisu(uid)!,
  //   )

  //   pap!.command.do(
  //     new Commands.DocumentManipulateLayerNodes({
  //       remove: removePaths,
  //     }),
  //   )
  // })

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

    notifyStore.emit({ type: 'saving' })
    await new Promise<void>((r) => setTimeout(r, 100))

    const packer = msgpack()
    const bin = packer.encode({ doc, papEditor: {} }) as unknown as Uint8Array
    const blob = new Blob([bin], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)

    if (handler) {
      await (
        await handler.createWritable({ keepExistingData: false })
      ).write(blob)

      notifyStore.emit({ type: 'saved' })
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
    const doc = editorHandle!.currentDocument
    const strokingTarget = editorHandle?.getStrokingTarget()
    if (!doc || !strokingTarget || !editorHandle) return

    const nodes = editorHandle?.getDisplayedResolvedNodes()
    const visuUids = nodes.map((node) => node.uid)

    editorHandle?.setSelectedVisuUids(visuUids)
  })

  useGlobalMousetrap(shortcuts.global.unselectAll, () => {
    editorHandle?.setSelectedVisuUids([])
  })

  useGlobalMousetrap(shortcuts.global.brushTool, () => {
    editorHandle?.setToolMode(ToolModes.strokingTool)
  })

  useGlobalMousetrap(shortcuts.global.vectorShapeRectTool, () => {
    editorHandle?.setToolMode(ToolModes.rectangleTool)
  })

  useGlobalMousetrap(shortcuts.global.vectorEllipseTool, () => {
    editorHandle?.setToolMode(ToolModes.ellipseTool)
  })

  useGlobalMousetrap(shortcuts.global.vectorObjectTool, () => {
    editorHandle?.setToolMode(ToolModes.objectTool)
  })

  useGlobalMousetrap(shortcuts.global.vectorPointTool, () => {
    editorHandle?.setToolMode(ToolModes.pointTool)
  })

  useGlobalMousetrap(shortcuts.global.vectorPenTool, () => {
    editorHandle?.setToolMode(ToolModes.vectorPenTool)
  })

  useGlobalMousetrap(['shift+c'], () => {
    editorHandle?.setToolMode(ToolModes.curveTool)
  })

  return null
})
