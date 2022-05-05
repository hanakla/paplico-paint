import { Psd, Layer, writePsd, BlendMode } from 'ag-psd'
import { Document } from '../DOM'
import { CompositeMode } from '../DOM/ILayer'
import { PaplicoEngine } from '../engine/Engine3'
import { LayerSpreadRenderer } from '../engine/RenderStrategy/LayerSpreadRenderer'
import { createContext2D } from '../Engine3_CanvasFactory'
import { PapDOMDigger } from '../PapDOMDigger'
import { setCanvasSize } from '../utils'

const blendModeForPsd = (mode: CompositeMode): BlendMode | undefined => {
  // prettier-ignore
  return mode === 'normal' ? 'normal'
    : mode === 'screen' ? 'screen'
    : mode === 'multiply' ? 'multiply'
    : mode === 'overlay' ? 'overlay'
    : undefined
}

export class PSD {
  public async export(
    engine: PaplicoEngine,
    document: Document
  ): Promise<Blob> {
    const strategy = new LayerSpreadRenderer('image/png')

    try {
      await engine.render(document, strategy, { target: null })

      const results = strategy.getRootLayerResults()
      const buf = createContext2D()
      let children: Layer[] = []
      for (let idx = 0; idx < results.length; idx++) {
        const layer = results[idx]
        const next = results[idx + 1]

        let clipImage: ImageData | null = null

        if (layer.compositeMode === 'clipper') continue
        if (next?.compositeMode === 'clipper') {
          clipImage = await this.blobToImageData(buf, next.blob)
        }

        children.push({
          imageData: await this.blobToImageData(buf, layer.blob),
          name: PapDOMDigger.findLayerRecursive(document, layer.uid)?.name,
          blendMode: blendModeForPsd(layer.compositeMode),
          opacity: layer.opacity / 100,
          ...(clipImage != null
            ? {
                mask: {
                  imageData: clipImage,
                },
              }
            : {}),
        })
      }

      const psd: Psd = {
        width: document.width,
        height: document.height,
        children,
        colorMode: 3, // ColorMode.RGB
      }

      const psdBuf = writePsd(psd, {
        generateThumbnail: true,
        noBackground: true,
      })
      const blob = new Blob([psdBuf], { type: 'image/psd' })

      return blob
    } finally {
      strategy.dispose()
    }
  }

  private async blobToImageData(
    buf: CanvasRenderingContext2D,
    blob: Blob
  ): Promise<ImageData> {
    const img = await createImageBitmap(blob)
    setCanvasSize(buf.canvas, img)
    buf.drawImage(img, 0, 0)
    return buf.getImageData(0, 0, img.width, img.height)
  }
}
