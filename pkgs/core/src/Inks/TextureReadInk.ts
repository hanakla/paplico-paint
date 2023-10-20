import { createSeededRandom, hsvToRgb, rgbToHsv } from '@/Math'
import { setCanvasSize } from '@/StrokingHelper'
import { freeingCanvas } from '@/utils/canvas'
import { createCanvas } from '../Engine/CanvasFactory'
import { IInk, InkGenerator } from '../Engine/Ink'
import { glitchNoise } from './texture/index'

export declare namespace TextureReadInk {
  type SpecificSetting = {}
}

export class TextureReadInk implements IInk {
  public static id = '@paplico/core/ink/TextureRead'
  public static version = '0.0.1'

  public get class() {
    return TextureReadInk
  }

  public texture: ImageData

  public async initialize() {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
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

  public getInkGenerator(ctx: any): InkGenerator {
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
        totalLength
      }) => {
        // const random = createSeededRandom(pointIndex)

        // const baseHsv = rgbToHsv(baseColor.r, baseColor.g, baseColor.b)

        const pos = Math.trunc((pointAtLength / totalLength) * bytes) % bytes
        const data = this.texture.data

        const [h, s, v] = rgbToHsv(
          data[pos + 0] / 255,
          data[pos + 1] / 255,
          data[pos + 2] / 255
        )
        const [r, g, b] = hsvToRgb(h, s, v)

        return { r, g, b, a: baseColor.a }
      }
    }
  }
}