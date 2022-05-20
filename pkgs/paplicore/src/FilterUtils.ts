import { saveAndRestoreCanvas } from './utils/canvas'

export const mergeCanvasToDest = (
  result: HTMLCanvasElement,
  dest: CanvasRenderingContext2D,
  options: { opacity: number }
) => {
  saveAndRestoreCanvas(dest, (ctx) => {
    ctx.globalAlpha = options.opacity
  })
}
