import { rgba } from 'polished'
import {
  BrushContext,
  BrushLayoutData,
  IBrush,
  createBrush,
} from '@/Engine/Brush/Brush'
import { mergeToNew } from '@/utils/object'
import { mapPoints } from '../Engine/VectorUtils'
import { scatterPlot } from '@/ext-brush'
import { PapBrush } from '@/index'

export declare namespace CircleBrush {
  type Settings = {
    lineCap: CanvasLineCap
  }
}

export const CircleBrush = createBrush(
  class CircleBrush implements IBrush {
    public static readonly metadata = {
      id: '@paplico/core/circle-brush',
      version: '0.0.1',
      name: 'Circle Brush',
    }

    public static getInitialConfig(): CircleBrush.Settings {
      return {
        lineCap: 'round',
      }
    }

    public static renderPane({
      c,
      h,
      state,
      setState,
    }: PapBrush.BrushPaneContext<CircleBrush.Settings>) {
      return h(c.Text, {}, 'WIP')
    }

    public async initialize() {}

    public async render({
      destContext: ctx,
      path: inputPath,
      transform,
      // ink,
      brushSetting: { size, color, opacity, specific },
      destSize,
    }: BrushContext<CircleBrush.Settings>): Promise<BrushLayoutData> {
      const sp = mergeToNew(CircleBrush.getInitialConfig(), specific)

      const bbox: BrushLayoutData['bbox'] = {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      }

      ctx.translate(destSize.width / 2, destSize.height / 2)
      ctx.translate(transform.translate.x, transform.translate.y)
      ctx.scale(transform.scale.x, transform.scale.y)
      ctx.rotate(transform.rotate)
      ctx.translate(-destSize.width / 2, -destSize.height / 2)

      ctx.lineWidth = size
      ctx.strokeStyle = `${rgba(
        color.r * 255,
        color.g * 255,
        color.b * 255,
        opacity,
      )}`
      ctx.lineCap = sp.lineCap

      for (const path of inputPath) {
        for (let idx = 0, l = path.points.length; idx < l; idx++) {
          const pt = path.points[idx]
          const prev = path.points[idx - 1]

          if (pt.isMoveTo) {
            ctx.moveTo(pt.x, pt.y)
          } else if (pt.isClose) {
            ctx.closePath()
          } else {
            if (!prev) {
              throw new Error('Unexpected point, previouse point is nukk')
            }

            ctx.bezierCurveTo(
              pt!.begin?.x ?? prev!.x,
              pt!.begin?.y ?? prev!.y,
              pt.end?.x ?? pt.x,
              pt.end?.y ?? pt.y,
              pt.x,
              pt.y,
            )
          }
        }
      }

      ctx.stroke()

      return { bbox }
    }
  },
)
