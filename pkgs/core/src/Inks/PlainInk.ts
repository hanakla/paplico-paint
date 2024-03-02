import { IInk, InkGenerator, createInk } from '../Engine/Ink'

export declare namespace PlainInk {
  type Setting = {}
}

export const PlainInk = createInk(
  class PlainInk implements IInk<PlainInk.Setting> {
    public static metadata = {
      id: '@paplico/core/ink/plain',
      version: '0.0.1',
      name: 'Plain',
    }

    public static getInitialSetting() {
      return {}
    }

    public get id() {
      return PlainInk.metadata.id
    }

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
        },
      }
    }
  },
)
