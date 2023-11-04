import { clearCanvas, setCanvasSize } from '@/utils/canvas'
import { createContext2D } from './CanvasFactory'
import { shallowEquals } from '@/utils/object'

type Allocced = {
  used: boolean
  ctx: CanvasRenderingContext2D
  createOpt: CanvasRenderingContext2DSettings
  stack?: string | null
}

export class Canvas2DAllocator {
  protected static _allocated: Array<Allocced> = []

  private constructor() {}

  public static borrow({
    width,
    height,
    ...canvasOpt
  }: { width: number; height: number } & CanvasRenderingContext2DSettings) {
    let lend: Allocced | null = null

    for (const entry of this._allocated) {
      const optionsMatched = shallowEquals(canvasOpt, entry.createOpt)

      if (
        !entry.used &&
        entry.ctx.canvas.width === width &&
        entry.ctx.canvas.height === height &&
        optionsMatched
      ) {
        entry.used = true
        entry.stack = new Error().stack
        clearCanvas(entry.ctx)
        return entry.ctx
      } else if (!entry.used && optionsMatched) {
        lend = entry
      }
    }

    if (lend) {
      lend.used = true
      lend.stack = new Error().stack
      setCanvasSize(lend.ctx.canvas, width, height)
      return lend.ctx
    } else {
      const entry: Allocced = {
        used: true,
        ctx: createContext2D(canvasOpt),
        createOpt: canvasOpt,
        stack: new Error().stack,
      }
      setCanvasSize(entry.ctx.canvas, width, height)
      this._allocated.push(entry)
      return entry.ctx
    }
  }

  public static release(ctx: CanvasRenderingContext2D | null | undefined) {
    if (ctx == null) return

    const entry = this._allocated.find((a) => a.ctx === ctx)
    if (!entry) return

    entry.used = false
    entry.stack = null
  }
}
