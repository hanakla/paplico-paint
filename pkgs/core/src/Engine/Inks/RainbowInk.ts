import { createSeededRandom } from '@/Math'
import { IInk, InkGenerator } from '../Ink'

export class RainbowInk implements IInk {
  public static id = '@paplico/core/ink/rainbow'
  public static version = '0.0.1'

  public get class() {
    return RainbowInk
  }

  public initialize() {}

  getInkGenerator(ctx: any): InkGenerator {
    return {
      applyTexture(canvas, context) {
        return
      },
      getColor({ pointIndex, points, baseColor }) {
        const random = createSeededRandom(pointIndex)

        return baseColor

        return {
          r: random.nextFloat(),
          g: random.nextFloat(),
          b: random.nextFloat(),
          a: baseColor.a,
        }
      },
    }
  }
}
