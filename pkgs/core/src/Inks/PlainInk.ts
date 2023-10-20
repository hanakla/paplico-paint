import { IInk, InkGenerator } from '../Engine/Ink'

export declare namespace PlainInk {
  type SpecificSetting = {}
}

export class PlainInk implements IInk {
  public static id = '@paplico/core/ink/plain'
  public static version = '0.0.1'

  public get class() {
    return PlainInk
  }

  public initialize() {}

  getInkGenerator(ctx: any): InkGenerator {
    return {
      applyTexture(canvas, context) {
        return
      },
      getColor({ pointIndex, points, baseColor }) {
        return baseColor
      }
    }
  }
}
