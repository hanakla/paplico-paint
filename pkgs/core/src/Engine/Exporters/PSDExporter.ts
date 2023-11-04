import type { Psd, Layer } from 'ag-psd'
import { IExporter } from './IExporter'
import { createContext2D } from '@/Engine/CanvasFactory'
import { setCanvasSize, freeingCanvas } from '@/utils/canvas'
import { rescue } from '@/utils/rescue'
import { ExportError } from '@/Errors/ExportError'
import { imageBitmapToImageData } from '@/utils/imageObject'
import { CompositeMode } from '@/Document'
import { unreachable } from '@/utils/unreachable'

export namespace PSDExporter {
  export type Options = IExporter.Options<{
    keepLayers: boolean
  }>
}

export class PSDExporter implements IExporter {
  async export(
    { paplico, runtimeDocument }: IExporter.Context,
    { keepLayers, pixelRatio, dpi, targetNodePath }: PSDExporter.Options,
  ): Promise<Blob> {
    const importResult = await rescue(() => import('ag-psd'))

    if (!importResult.success) {
      throw new Error(
        'PSDExporter: importing `ag-psd` was failed, please check to `ag-psd` is installed',
        { cause: importResult.error },
      )
    }

    const { writePsd } = importResult.result
    const { mainArtboard } = runtimeDocument.document.meta

    const cx = createContext2D()
    setCanvasSize(
      cx.canvas,
      mainArtboard.width * pixelRatio,
      mainArtboard.height * pixelRatio,
    )

    if (targetNodePath && targetNodePath.length > 0) {
      throw new ExportError('PSDExporter: targetNodePath is not supported yet')
    }

    try {
      await paplico.rerender({ destination: cx, pixelRatio })

      const children: Layer[] = []

      if (keepLayers) {
        for (const node of runtimeDocument.document.layerTree.children) {
          const layer = runtimeDocument.document.resolveLayerEntity(
            node.layerUid,
          )!

          const bitmap = runtimeDocument.getLayerBitmapCache(node.layerUid)

          if (!bitmap) {
            throw new ExportError(
              `PSDExporter: bitmap not found for layer ${node.layerUid}`,
            )
          }

          const imageData = imageBitmapToImageData(bitmap)

          children.push({
            imageData,
            name: layer.name,
            blendMode: compositeModeToBlendMode(layer.compositeMode),
          })
        }

        // throw new Error('PSDExporter: keepLayers is not supported yet')
      } else {
        children.push({
          imageData: cx.getImageData(0, 0, cx.canvas.width, cx.canvas.height),
          name: 'root',
          blendMode: 'normal',
        })
      }

      const psd: Psd = {
        width: mainArtboard.width,
        height: mainArtboard.height,
        children,
        colorMode: 3, // ColorMode.RGB
        imageResources: {
          resolutionInfo: {
            horizontalResolution: dpi,
            horizontalResolutionUnit: 'PPI',
            heightUnit: 'Centimeters',
            verticalResolution: dpi,
            verticalResolutionUnit: 'PPI',
            widthUnit: 'Centimeters',
          },
        },
      }

      const psdData = writePsd(psd, {
        generateThumbnail: true,
        noBackground: true,
      })

      return new Blob([psdData], { type: 'image/psd' })
    } catch (e) {
      throw new Error('PSDExporter: exporting was failed', { cause: e })
    } finally {
      freeingCanvas(cx.canvas)
    }
  }
}

function compositeModeToBlendMode(mode: CompositeMode) {
  // prettier-ignore
  return mode === 'normal' ? 'normal'
    : mode === 'screen' ? 'screen'
    : mode === 'multiply' ? 'multiply'
    : mode === 'overlay' ? 'overlay'
    : mode === 'clipper' ? 'dissolve'
    : unreachable(mode)
}
