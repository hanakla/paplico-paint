import { rgba } from 'polished'
import { BrushContext, IBrush } from '../engine/IBrush'
import { mergeToNew } from '../utils'

export declare namespace Brush {
  type SpecificSetting = {
    lineCap: CanvasLineCap
  }
}

export class Brush implements IBrush {
  public static readonly id = '@silk-paint/brush'

  public get id() {
    return Brush.id
  }

  public getInitialSpecificConfig(): Brush.SpecificSetting {
    return {
      lineCap: 'square',
    }
  }

  public async initialize() {}

  public render({
    context: ctx,
    path: inputPath,
    ink,
    brushSetting: { size, color, opacity, specific },
  }: BrushContext) {
    const sp = mergeToNew(this.getInitialSpecificConfig(), specific)

    const { points, closed } = inputPath
    const [start] = points

    ctx.lineWidth = size
    ctx.strokeStyle = `${rgba(
      color.r * 255,
      color.g * 255,
      color.b * 255,
      opacity
    )}`
    ctx.lineCap = sp.lineCap

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)

    inputPath.mapPoints(
      (point, prev) => {
        ctx.bezierCurveTo(
          prev!.out?.x ?? prev!.x,
          prev!.out?.y ?? prev!.y,
          point.in?.x ?? point.x,
          point.in?.y ?? point.y,
          point.x,
          point.y
        )
      },
      { startOffset: 1 }
    )

    if (closed) ctx.closePath()

    ctx.stroke()
  }
}
