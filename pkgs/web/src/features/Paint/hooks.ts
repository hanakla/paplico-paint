import { useStore } from '@fleur/react'
import { letDownload, match, useFunk } from '@hanakla/arma'
import { useTranslation } from 'next-i18next'
import {
  useEffect,
  useRef,
  useMemo,
  ChangeEvent,
  createContext,
  useContext,
  MutableRefObject,
  createRef,
} from 'react'
import { usePrevious, useUpdate } from 'react-use'
import { PapDOM, PapSerializer, PapCommands } from '@paplico/core'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { NotifyOps } from '🙌/domains/Notify'
import { useBufferedState, useDebouncedFunk, useFleur } from '🙌/utils/hooks'
import { debounce } from '🙌/utils/func'

export const usePaplicoExporter = () => {
  const { t } = useTranslation('app')

  const { execute, getStore } = useFleur()
  const { engine, currentDocument } = useStore((get) => ({
    engine: get(EditorStore).state.engine,
    currentDocument: EditorSelector.currentDocument(get),
  }))

  return {
    exportDocument: useFunk(async () => {
      if (!currentDocument) return

      const bin = PapSerializer.exportDocument(
        currentDocument as PapDOM.Document
      )!
      const blob = new Blob([bin], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)

      if (typeof window.showSaveFilePicker === 'undefined') {
        letDownload(url, 'test.paplc')
      } else {
        const handler =
          getStore(EditorStore).state.currentFileHandler ??
          (await window.showSaveFilePicker({
            types: [
              {
                description: 'Paplico project',
                accept: { 'application/octet-stream': '.paplc' },
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
        messageKey: t('exports.exported'),
      })

      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }),
  }
}

export const useDocumentWatch = (
  document: PapDOM.Document | null | undefined
) => {
  const rerender = useUpdate()

  useEffect(() => {
    document?.on('layersChanged', rerender)
    return () => document?.off('layersChanged', rerender)
  }, [document?.uid, rerender])
}

export const useLayerWatch = (layer: PapDOM.LayerTypes | null | undefined) => {
  const rerender = useUpdate()

  useEffect(() => {
    layer?.on('updated', rerender)
    return () => layer?.off('updated', rerender)
  }, [layer?.uid, rerender])
}

export const useLayerListWatch = (
  layers: Array<PapDOM.LayerTypes | null | undefined>
) => {
  const rerender = useUpdate()
  // const prev = usePrevious(layers)

  useEffect(() => {
    layers.forEach((l) => l?.on('updated', rerender))
    return () => layers.forEach((l) => l?.off('updated', rerender))
  })
}

export const useVectorObjectWatch = (
  object: PapDOM.VectorObject | null | undefined
) => {
  const rerender = useUpdate()

  useEffect(() => {
    object?.on('updated', rerender)
    return () => object?.off('updated', rerender)
  })
}

export const usePapFilterWatch = (filter: PapDOM.Filter | null | undefined) => {
  const rerender = useUpdate()

  useEffect(() => {
    filter?.on('updated', rerender)
    return () => filter?.off('updated', rerender)
  })
}

export const useTransactionCommand = ({
  threshold = 1000,
}: {
  threshold?: number
} = {}) => {
  const rerender = useUpdate()
  const { execute } = useFleur()

  const ref = useRef<PapCommands.Transaction | null>(null)
  const debouncedCommit = useMemo(
    () =>
      debounce(() => {
        ref.current = null
        execute(EditorOps.rerenderCanvas)
      }, threshold),
    [threshold]
  )

  return useMemo(
    () => ({
      get isStarted() {
        return !!ref.current
      },
      startIfNotStarted: () => {
        if (ref.current) return
        ref.current = new PapCommands.Transaction({ commands: [] })
        execute(EditorOps.runCommand, ref.current)
      },
      doAndAdd: (command: PapCommands.AnyCommandType) => {
        ref.current?.doAndAddCommand(command)
        rerender()
      },
      autoStartAndDoAdd: (command: PapCommands.AnyCommandType) => {
        if (!ref.current) {
          ref.current = new PapCommands.Transaction({ commands: [] })
          execute(EditorOps.runCommand, ref.current)
        }

        ref.current?.doAndAddCommand(command)
        rerender()
      },
      cancel: () => {
        if (!ref.current) return
        execute(EditorOps.revertCommand, { whenCommandIs: ref.current })
        ref.current = null
      },
      rerenderCanvas: () => {
        execute(EditorOps.rerenderCanvas)
      },
      commit: () => {
        ref.current = null
        execute(EditorOps.rerenderCanvas)
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
        new PapCommands.Layer.PatchLayerAttr({
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
    if (!activeLayerPath) return

    execute(
      EditorOps.runCommand,
      new PapCommands.Layer.DeleteLayer({
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

export const PaintCanvasContext = createContext<
  MutableRefObject<HTMLCanvasElement | null>
>(createRef<HTMLCanvasElement | null>())

export const usePaintCanvasRef = () => {
  return useContext(PaintCanvasContext)
}

export const useWhiteNoise = () => {
  useEffect(() => {
    // if (!WhiteNoiseNode) return
    // const Worker = function (url: URL) {
    //   return url
    // }
    // const ctx = new AudioContext()
    // const modulator = new OscillatorNode(ctx)
    // ctx.audioWorklet
    //   .addModule(
    //     new AudioWorklet(
    //       new URL('./sounds/WhiteNoiseWorklet.js', import.meta.url)
    //     )
    //   )
    //   .then(() => {
    //     if (!WhiteNoiseNode) return
    //     const node = new AudioWorkletNode(ctx, 'PaplicoWhiteNoise')
    //     node.connect(ctx.destination)
    //     ctx.resume()
    //     // modulator.connect(node)
    //   })
    // modulator.connect(ctx.destination)
    // modulator.start()
    // return () => {
    //   ctx.close()
    // }
  }, [])
}
