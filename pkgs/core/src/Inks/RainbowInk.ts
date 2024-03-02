import { hsvToRgb, rgbToHsv } from '@/Math'
import { IInk, InkGenerator, createInk } from '../Engine/Ink'

export declare namespace RainbowInk {
  type Setting = {}
}

export const RainbowInk = createInk(
  class RainbowInk implements IInk<RainbowInk.Setting> {
    public static metadata = {
      id: '@paplico/core/ink/rainbow',
      version: '0.0.1',
      name: 'Rainbow Ink',
    }

    public static getInitialSetting(): RainbowInk.Setting {
      return {}
    }

    public get id() {
      return RainbowInk.metadata.id
    }

    public initialize() {}

    public getInkGenerator(ctx: any): InkGenerator {
      return {
        applyTexture(canvas, context) {
          return
        },
        getColor({
          pointIndex,
          points,
          baseColor,
          pointAtLength,
          totalLength,
        }) {
          const [h, s, v] = rgbToHsv(baseColor.r, baseColor.g, baseColor.b)
          const newH = h + pointAtLength / totalLength
          const [r, g, b] = hsvToRgb(newH, s, v)

          return { r, g, b, a: baseColor.a }
        },
      }
    }
  },
)
