import { rgba } from "polished";
import { BrushContext, IBrush } from "../engine/IBrush";

export class Brush implements IBrush {
  public static readonly id = '@silk-paint/brush'

  public get id() {
    return Brush.id
  }

  public async initialize() {}

  public render({context: ctx, stroke, ink, brushSetting: {weight, color, opacity} }: BrushContext) {
    ctx.lineWidth = weight
    ctx.strokeStyle = `${rgba(color.r, color.g, color.b, opacity)}`
    ctx.lineCap = 'round'
    console.log(ctx.strokeStyle)

    const {start, points} = stroke.splinedPath

    ctx.beginPath()
    ctx.moveTo(start[0], start[1])

    for(const {c1x, c1y, c2x, c2y, x, y} of points) {
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y)
    }

    ctx.stroke()
  }
}
