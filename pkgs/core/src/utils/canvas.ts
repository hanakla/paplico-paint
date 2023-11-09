import { assign } from './object'
import { unreachable } from './unreachable'

export const saveAndRestoreCanvas = <
  C extends CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  T extends (ctx: C) => any,
>(
  ctx: C,
  proc: T,
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
    size: { width: number; height: number },
    clear?: { clear: boolean },
  ): void
  (
    canvas: HTMLCanvasElement | OffscreenCanvas,
    width: number,
    height: number,
    clear?: { clear: boolean },
  ): void
} = (canvas, widthOrSize, height, clear?: { clear: boolean }) => {
  // prettier-ignore
  const _size =
    (typeof widthOrSize === 'object')
      // if property not enumerable, failed to assign size later.
      ? { width: widthOrSize.width, height: widthOrSize.height }
      : typeof height === 'number' ? { width: widthOrSize, height }
      : unreachable(height as never)

  const _clear = typeof height === 'number' ? clear?.clear : height?.clear

  if (canvas.width === _size.width && canvas.height === _size.height) {
    if (_clear) clearCanvas(canvas.getContext('2d')!)
    else return
  } else {
    assign(canvas, _size)
  }
}

export const clearCanvas = (
  cx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
) => {
  cx.canvas.width += 0.1
  // cx.clearRect(0, 0, cx.canvas.width, cx.canvas.height)
}

/** Freeing memory for Safari canvas */
export const freeingCanvas = (canvas: HTMLCanvasElement) => {
  setCanvasSize(canvas, 0, 0)
}

export const canvasToBlob = async (
  canvas: HTMLCanvasElement,
  type?: string,
  quality?: number,
) => {
  return new Promise<Blob>((resolve, reject) => {
    if (canvas.toBlob != null) {
      canvas.toBlob(
        (blob) => {
          if (blob == null) return reject(new Error('Failed to Canvas.toBlob'))
          else resolve(blob!)
        },
        type,
        quality,
      )
    } else {
      // for node-canvas
      const dataurl = canvas.toDataURL(type, quality)
      const buffer = Buffer.from(dataurl.split(',')[1], 'base64')
      return resolve(new Blob([buffer], { type }))
    }
  })
}
