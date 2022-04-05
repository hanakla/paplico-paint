import { rgba } from 'polished'
import { BrushContext, IBrush } from '../engine/IBrush'

export class Brush implements IBrush {
  public static readonly id = '@silk-paint/brush'

  public get id() {
    return Brush.id
  }

  public async initialize() {}

  public render({
    context: ctx,
    stroke,
    ink,
    brushSetting: { size, color, opacity },
  }: BrushContext) {
    ctx.lineWidth = size
    ctx.strokeStyle = `${rgba(color.r, color.g, color.b, opacity)}`
    ctx.lineCap = 'round'

    const { points, closed } = stroke.path
    const [start] = points

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)

    stroke.path.mapPoints(
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
