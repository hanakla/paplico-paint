import { hsvToRgb, rgbToHsv } from '@/Math'
import { freeingCanvas, setCanvasSize } from '@/utils/canvas'
import { createCanvas, createImage } from '../Engine/CanvasFactory'
import { glitchNoise } from './texture/index'
import { IInk, InkGenerator, InkMetadata, createInk } from '@/ext-ink'

export declare namespace TextureReadInk {
  type Setting = {}
}

export const TextureReadInk = createInk(
  class TextureReadInk implements IInk<TextureReadInk.Setting> {
    public static metadata: InkMetadata = {
      id: '@paplico/core/ink/TextureRead',
      version: '0.0.1',
      name: 'Texture Read Ink',
    }

    public static getInitialSetting(): TextureReadInk.Setting {
      return {}
    }

    public get id() {
      return TextureReadInk.metadata.id
    }

    public texture!: ImageData

    public async initialize() {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = createImage()
        img.onload = () => resolve(img)
        img.onerror = (e) => reject(e)
        img.src = glitchNoise
      })

      const canvas = createCanvas()
      setCanvasSize(canvas, { width: img.width, height: img.height })

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      this.texture = ctx.getImageData(0, 0, img.width, img.height)

      freeingCanvas(canvas)
    }

    public getInkGenerator(ctx: any): InkGenerator<TextureReadInk.Setting> {
      const bytes = this.texture.width * this.texture.height * 4

      return {
        applyTexture(canvas, context) {
          return
        },
        getColor: ({
          pointIndex,
          points,
          baseColor,
          pointAtLength,
          totalLength,
          pixelRatio,
        }) => {
          // const random = createSeededRandom(pointIndex)

          // const baseHsv = rgbToHsv(baseColor.r, baseColor.g, baseColor.b)

          const pos =
            Math.trunc(
              (pointAtLength / totalLength) * (1 / pixelRatio) * bytes,
            ) % bytes
          const data = this.texture.data

          const [h, s, v] = rgbToHsv(
            data[pos + 0] / 255,
            data[pos + 1] / 255,
            data[pos + 2] / 255,
          )
          const [r, g, b] = hsvToRgb(h, s, v)

          return { r, g, b, a: baseColor.a }
        },
      }
    }
  },
)
