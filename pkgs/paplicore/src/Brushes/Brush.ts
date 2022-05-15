import { rgba } from 'polished'
import { BrushContext, IBrush } from '../engine/IBrush'
import { mergeToNew } from '../utils/object'

export declare namespace Brush {
  type SpecificSetting = {
    lineCap: CanvasLineCap
  }
}

export class Brush implements IBrush {
  public static readonly id = '@paplico/brushes/brush'

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
    transform,
    ink,
    brushSetting: { size, color, opacity, specific },
    destSize,
  }: BrushContext) {
    const sp = mergeToNew(this.getInitialSpecificConfig(), specific)

    const { points, closed } = inputPath
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
