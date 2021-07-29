import { BrushContext, IBrush } from "./IBrush";

export class Brush implements IBrush {
  public render({context: ctx, stroke, ink, brushSetting }: BrushContext) {
    console.log(ctx.lineWidth)
    ctx.lineWidth = brushSetting.weight
    ctx.strokeStyle = ink.color()

    const [start, ...points] = stroke.points

    ctx.beginPath()
    ctx.moveTo(start[0], start[1])

    points.forEach(([x, y]) => {
      ctx.lineTo(x,y)
    })

    ctx.stroke()
  }
}
