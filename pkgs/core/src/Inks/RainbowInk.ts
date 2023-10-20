import { createSeededRandom, hsvToRgb, rgbToHsv } from '@/Math'
import { IInk, InkGenerator } from '../Engine/Ink'

export declare namespace RainbowInk {
  type SpecificSetting = {}
}

export class RainbowInk implements IInk {
  public static id = '@paplico/core/ink/rainbow'
  public static version = '0.0.1'

  public get class() {
    return RainbowInk
  }

  public initialize() {}

  public getInkGenerator(ctx: any): InkGenerator {
    return {
      applyTexture(canvas, context) {
        return
      },
      getColor({ pointIndex, points, baseColor, pointAtLength, totalLength }) {
        // const random = createSeededRandom(pointIndex)

        const [h, s, v] = rgbToHsv(baseColor.r, baseColor.g, baseColor.b)
        const newH = h + pointAtLength / totalLength
        const [r, g, b] = hsvToRgb(newH, s, v)

        return { r, g, b, a: baseColor.a }
      }
    }
  }
}
