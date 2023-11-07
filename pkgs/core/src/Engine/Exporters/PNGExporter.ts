import { canvasToBlob, setCanvasSize } from '@/utils/canvas'
import { createContext2D } from '../../Infra/CanvasFactory'
import { IExporter } from './IExporter'
import { freeingCanvas } from '@/utils/canvas'

export namespace PNGExporter {
  export type Options = IExporter.Options<{}>
}

export class PNGExporter implements IExporter {
  async export(
    { paplico, runtimeDocument }: IExporter.Context,
    { pixelRatio }: { targetNode?: string[] | undefined; pixelRatio: number },
  ): Promise<Blob> {
    const { mainArtboard } = runtimeDocument.document.meta
    const { width, height } = mainArtboard
    const cx = createContext2D()
    setCanvasSize(cx.canvas, width * pixelRatio, height * pixelRatio)

    try {
      await paplico.rerender({ destination: cx, pixelRatio })
      return canvasToBlob(cx.canvas, 'image/png', 1)
    } finally {
      freeingCanvas(cx.canvas)
    }
  }
}
