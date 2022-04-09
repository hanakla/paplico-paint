import { Silk3, SilkDOM, SilkInks } from 'silk-core'
import { assign } from '🙌/utils/object'

export const isEventIgnoringTarget = (target: EventTarget | null) => {
  return (target as HTMLElement)?.dataset?.isPaintCanvas != null
}

export const generateBrushThumbnail = async (
  engine: Silk3,
  brushId: string,
  {
    size,
    brushSize,
  }: { size: { width: number; height: number }; brushSize: number }
) => {
  const ctx = document.createElement('canvas').getContext('2d')!
  assign(ctx.canvas, size)

  const path = SilkDOM.Path.create({
    points: [
      {
        x: size.width / 2,
        y: size.height / 2,
        in: null,
        out: null,
        pressure: 1,
      },
      {
        x: size.width / 2,
        y: size.height / 2,
        in: null,
        out: null,
        pressure: 1,
      },
    ],
    closed: false,
    randomSeed: 0,
  })

  await engine.renderPath(
    {
      brushId,
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
      size: brushSize,
      specific: {},
    },
    new SilkInks.PlainInk(),
    path,
    ctx
  )

  return ctx.canvas.toDataURL('image/png')
}
