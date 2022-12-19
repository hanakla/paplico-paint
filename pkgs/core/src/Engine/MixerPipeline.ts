import { CompositeMode, PaplicoDocument } from '@/Document'
import { saveAndRestoreCanvas, setCanvasSize } from '@/utils/canvas'
import { BrushRegistry } from './BrushRegistry'
import { createCanvas } from './CanvasFactory'
import { Renderer } from './Renderer'
import { RuntimeDocument } from './RuntimeDocument'
import { Viewport } from './types'

export class MixerPipeline {
  protected brushRegistry: BrushRegistry
  protected canvas: HTMLCanvasElement

  constructor(options: {
    brushRegistry: BrushRegistry
    canvas: HTMLCanvasElement
  }) {
    this.brushRegistry = options.brushRegistry
    this.canvas = options.canvas
  }

  // public setDocument(doc: PaplicoDocument) {
  //   this.runtimeDoc = new RuntimeDocument(doc)
  // }

  public mix(
    dest: CanvasRenderingContext2D,
    input: CanvasRenderingContext2D,
    options: { composition: 'normal' | 'erase' }
  ) {
    dest.drawImage(input.canvas, 0, 0)
  }

  public async fullyRender(
    dest: CanvasRenderingContext2D,
    doc: RuntimeDocument,
    render: Renderer,
    {
      viewport,
      override,
    }: {
      viewport: Viewport
      override?: { [layerId: string]: HTMLCanvasElement | ImageBitmap }
    }
  ) {
    const tmp = createCanvas()
    const tmpctx = tmp.getContext('2d')!
    setCanvasSize(tmp, viewport)

    dest.clearRect(0, 0, dest.canvas.width, dest.canvas.height)

    for (const node of doc.rootNodes) {
      const layer = doc.resolveLayer(node.layerUid)
      if (!layer) {
        console.error('Bad layer link', node.layerUid)
        continue
      }

      let image: ImageBitmap | HTMLCanvasElement | null
      if (override?.[layer.uid]) {
        image = override[layer.uid]
      } else if (layer.layerType === 'raster') {
        image = (await doc.getOrCreateLayerBitmapCache(layer.uid))!
      } else if (layer.layerType === 'vector') {
        const requestSize = { width: viewport.width, height: viewport.height }

        if (doc.hasLayerBitmapCache(layer.uid, requestSize)) {
          image = (await doc.getOrCreateLayerBitmapCache(
            layer.uid,
            requestSize
          ))!
        } else {
          image = (await doc.getOrCreateLayerBitmapCache(
            layer.uid,
            requestSize
          ))!

          await render.renderVectorLayer(tmp, layer, { viewport })

          doc.updateLayerBitmapCache(
            layer.uid,
            tmpctx.getImageData(0, 0, viewport.width, viewport.height)
          )
        }
      } else {
        // TODO
        continue
      }

      const mode = layerCompositeModeToCanvasCompositeMode(layer.compositeMode)
      saveAndRestoreCanvas(dest, () => {
        dest.globalCompositeOperation = mode
        dest.drawImage(image!, 0, 0)
      })
    }
  }

  // public async render() {}

  // public async renderVector() {}
}

const layerCompositeModeToCanvasCompositeMode = (mode: CompositeMode) =>
  ((
    {
      normal: 'source-over',
      clipper: 'destination-in',
      multiply: 'multiply',
      overlay: 'overlay',
      screen: 'screen',
    } as { [k in CompositeMode]: GlobalCompositeOperation }
  )[mode])
