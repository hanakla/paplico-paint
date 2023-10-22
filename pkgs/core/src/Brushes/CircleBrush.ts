import { rgba } from 'polished'
import { BrushContext, BrushLayoutData, IBrush } from '@/Engine/Brush'
import { mergeToNew } from '@/utils/object'
import { mapPoints } from '../Engine/VectorUtils'
import { scatterPlot } from '@/StrokingHelper'

export declare namespace CircleBrush {
  type SpecificSetting = {
    lineCap: CanvasLineCap
  }
}

export class CircleBrush implements IBrush {
  public static readonly id = '@paplico/core/circle-brush'

  public get id() {
    return CircleBrush.id
  }

  public getInitialSpecificConfig(): CircleBrush.SpecificSetting {
    return {
      lineCap: 'round',
    }
  }

  public async initialize() {}

  public async render({
    context: ctx,
    path: inputPath,
    transform,
    // ink,
    brushSetting: { size, color, opacity, specific },
    destSize,
  }: BrushContext<CircleBrush.SpecificSetting>): Promise<BrushLayoutData> {
    const sp = mergeToNew(this.getInitialSpecificConfig(), specific)

    const bbox: BrushLayoutData['bbox'] = {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    }

    inputPath.forEach((path) => {
      const { points, closed } = path
      const [start] = points

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

      ctx.beginPath()
      ctx.moveTo(start.x, start.y)

      // const scattered = scatterPlot(path, {
      //   counts: path.points.length,
      //   scatterRange: 2,
      //   scatterScale: 1,
      // })

      // console.log(scattered)

      // console.log('Circle brush: ', path.points)

      mapPoints(
        path.points,
        (point, prev) => {
          ctx.bezierCurveTo(
            point!.begin?.x ?? prev!.x,
            point!.begin?.y ?? prev!.y,
            point.end?.x ?? point.x,
            point.end?.y ?? point.y,
            point.x,
            point.y,
          )
        },
        { startOffset: 1 },
      )

      if (closed) ctx.closePath()
      ctx.stroke()
    })

    return { bbox }
  }
}
