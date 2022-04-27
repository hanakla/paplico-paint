import { useStore } from '@fleur/react'
import { letDownload, match, useFunk } from '@hanakla/arma'
import { useTranslation } from 'next-i18next'
import { useEffect, useRef, useMemo } from 'react'
import { useUpdate } from 'react-use'
import { SilkDOM, SilkSerializer, SilkCommands } from 'silk-core'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { NotifyOps } from '🙌/domains/Notify'
import { useFleur } from '🙌/utils/hooks'

export const useSilkExporter = () => {
  const { t } = useTranslation('app')

  const { execute, getStore } = useFleur()
  const { engine, currentDocument } = useStore((get) => ({
    engine: get(EditorStore).state.engine,
    currentDocument: EditorSelector.currentDocument(get),
  }))

  return {
    exportDocument: useFunk(async () => {
      if (!currentDocument) return

      const bin = SilkSerializer.exportDocument(
        currentDocument as SilkDOM.Document
      )!
      const blob = new Blob([bin], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)

      if (typeof window.showSaveFilePicker === 'undefined') {
        letDownload(url, 'test.silk')
      } else {
        const handler =
          getStore(EditorStore).state.currentFileHandler ??
          (await window.showSaveFilePicker({
            types: [
              {
                description: 'Silk project',
                accept: { 'application/octet-stream': '.silk' },
              },
            ],
          }))

        await (
          await handler.createWritable({ keepExistingData: false })
        ).write(blob)

        execute(EditorOps.setCurrentFileHandler, handler)
      }

      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }),
    exportAs: useFunk(async (type: 'png' | 'jpeg') => {
      if (!currentDocument || !engine) return

      const mime = match(type)
        .when('png', 'image/png')
        .when('jpeg', 'image/jpeg')
        ._(new Error(`Unexpected type ${type}`))

      const exporter = await engine.renderAndExport(currentDocument)

      const blob = await exporter.export(mime, 100)
      const url = URL.createObjectURL(blob)

      letDownload(
        url,
        !currentDocument.title
          ? `${t('untitled')}.${type}`
          : `${currentDocument.title}.${type}`
      )

      execute(NotifyOps.create, {
        area: 'save',
        timeout: 3000,
        message: t('exports.exported'),
      })

      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }),
  }
}

export const useLayerWatch = (layer: SilkDOM.LayerTypes | null | undefined) => {
  const rerender = useUpdate()

  useEffect(() => {
    layer?.on('updated', rerender)
    return () => layer?.off('updated', rerender)
  }, [layer?.uid, rerender])
}

export const useObjectWatch = (
  object: SilkDOM.VectorObject | null | undefined
) => {
  const rerender = useUpdate()

  useEffect(() => {
    object?.on('updated', rerender)
    return () => object?.off('updated', rerender)
  })
}

export const useTransactionCommand = () => {
  const { execute } = useFleur()

  const ref = useRef<SilkCommands.Transaction | null>(null)

  return useMemo(
    () => ({
      startIfNotStarted: () => {
        if (ref.current) return
        ref.current = new SilkCommands.Transaction({ commands: [] })
        execute(EditorOps.runCommand, ref.current)
      },
      doAndAdd: (command: SilkCommands.AnyCommandType) => {
        ref.current?.doAndAddCommand(command)
      },
      commit: () => {
        ref.current = null
      },
    }),
    []
  )
}
