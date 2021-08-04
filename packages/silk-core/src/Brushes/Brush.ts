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
    brushSetting: { weight, color, opacity },
  }: BrushContext) {
    ctx.lineWidth = weight
    ctx.strokeStyle = `${rgba(color.r, color.g, color.b, opacity)}`
    ctx.lineCap = 'round'

    // console.log(stroke.points)

    const { start, points } = stroke.splinedPath

    // ;[start, ...points].forEach((p, idx, pts) => {
    //   ctx.beginPath()
    //   const prev = pts[idx - 1] ? pts[idx - 1] : p

    //   ctx.moveTo(prev.x, prev.y)
    //   ctx.lineTo(p.x, p.y)
    //   ctx.stroke()
    // })

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)

    for (const { c1x, c1y, c2x, c2y, x, y } of points) {
      // ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y)
      ctx.lineTo(x, y)
    }

    ctx.stroke()
  }
}
