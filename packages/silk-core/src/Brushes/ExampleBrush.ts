import { BrushContext, IBrush } from '../engine/IBrush'
import img from './brush.png'

export class ExampleBrush implements IBrush {
  public static readonly id = '@silk-paint/example-blush'

  public get id() {
    return ExampleBrush.id
  }

  private image: HTMLImageElement | null = null

  public async initialize() {
    this.image = new Image()
    this.image.src = img.src

    await new Promise((resolve) => {
      this.image!.onload = resolve
    })
  }

  public render({ context: ctx, stroke, ink, brushSetting }: BrushContext) {
    if (!this.image) return

    const { width, height } = this.image

    stroke.eachSplinePoint(([x, y, force]) => {
      ctx.globalAlpha = force / 2
      ctx.drawImage(
        this.image!,
        x - width / 2,
        y - height / 2,
        width / 2,
        height / 2
      )
    })
  }
}
