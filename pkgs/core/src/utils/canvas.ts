import { assign } from './object'

export const saveAndRestoreCanvas = <
  C extends CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  T extends (ctx: C) => any
>(
  ctx: C,
  proc: T
) => {
  try {
    ctx.save()
    return proc(ctx)
  } catch (e) {
    throw e
  } finally {
    ctx.restore()
  }
}

export const setCanvasSize: {
  (
    canvas: HTMLCanvasElement | OffscreenCanvas,
    widthOrSize: number | { width: number; height: number },
    height?: number
  ): void
} = (canvas, widthOrSize, height) => {
  if (typeof widthOrSize === 'object') {
    const { width, height } = widthOrSize
    if (canvas.width === width && canvas.height === height) return
    assign(canvas, { width, height })
  } else {
    if (canvas.width === widthOrSize && canvas.height === height) return
    assign(canvas, { width: widthOrSize, height })
  }
}

/** Freeing memory for Safari canvas */
export const freeingCanvas = (canvas: HTMLCanvasElement) => {
  setCanvasSize(canvas, 0, 0)
}
