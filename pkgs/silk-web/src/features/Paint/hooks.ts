import { useStore } from '@fleur/react'
import { letDownload, match, useFunk } from '@hanakla/arma'
import { useTranslation } from 'next-i18next'
import { useEffect, useRef, useMemo, ChangeEvent } from 'react'
import { useUpdate } from 'react-use'
import { SilkDOM, SilkSerializer, SilkCommands } from 'silk-core'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { NotifyOps } from '🙌/domains/Notify'
import { useBufferedState, useDebouncedFunk, useFleur } from '🙌/utils/hooks'
import { debounce } from '🙌/utils/func'

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

export const useDocumentWatch = (
  document: SilkDOM.Document | null | undefined
) => {
  const rerender = useUpdate()

  useEffect(() => {
    document?.on('layersChanged', rerender)
    return () => document?.off('layersChanged', rerender)
  }, [document?.uid, rerender])
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

export const useTransactionCommand = ({
  threshold = 1000,
}: {
  threshold?: number
} = {}) => {
  const { execute } = useFleur()

  const ref = useRef<SilkCommands.Transaction | null>(null)
  const debouncedCommit = useMemo(
    () =>
      debounce(() => {
        ref.current = null
      }, threshold),
    [threshold]
  )

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
      autoStartAndDoAdd: (command: SilkCommands.AnyCommandType) => {
        if (!ref.current) {
          ref.current = new SilkCommands.Transaction({ commands: [] })
          execute(EditorOps.runCommand, ref.current)
        }

        ref.current?.doAndAddCommand(command)
      },
      commit: () => {
        ref.current = null
      },
      debouncedCommit,
    }),
    [debouncedCommit]
  )
}

export const useActiveLayerPane = () => {
  const { execute } = useFleur()
  const { activeLayer, activeLayerPath } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    activeLayerPath: EditorSelector.activeLayerPath(get),
  }))

  useLayerWatch(activeLayer)

  const [layerName, setLayerName] = useBufferedState(activeLayer?.name)

  const handleChangeLayerName = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      setLayerName(currentTarget.value)
      commitChangeLayerName(activeLayerPath, currentTarget.value)
    }
  )

  const commitChangeLayerName = useDebouncedFunk(
    (path: string[], layerName: string) => {
      if (!activeLayerPath) return
      execute(
        EditorOps.runCommand,
        new SilkCommands.Layer.PatchLayerAttr({
          patch: { name: layerName },
          pathToTargetLayer: path,
        })
      )
    },
    1000
  )

  const handleChangeCompositeMode = useFunk((value: string) => {
    if (!activeLayerPath) return

    execute(
      EditorOps.updateLayer,
      activeLayerPath,
      (layer) => (layer.compositeMode = value as any)
    )
  })

  const handleChangeOpacity = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayer) return

      execute(EditorOps.updateLayer, activeLayerPath, (layer) => {
        layer.opacity = currentTarget.valueAsNumber
      })
    }
  )

  const handleClickRemoveLayer = useFunk(() => {
    execute(
      EditorOps.runCommand,
      new SilkCommands.Layer.DeleteLayer({
        pathToTargetLayer: activeLayerPath,
      })
    )
  })

  return {
    handleChangeLayerName,
    handleChangeCompositeMode,
    handleChangeOpacity,
    handleClickRemoveLayer,
    state: { layerName, activeLayer },
  }
}
