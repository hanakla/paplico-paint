import { clearCanvas, freeingCanvas, setCanvasSize } from '@/utils/canvas'
import { createContext2D } from './CanvasFactory'
import { shallowEquals } from '@/utils/object'
import { PaplicoCanvasAllocationError } from '@/Errors'

type Allocced = {
  used: boolean
  ctx: StateSafeCanvasRenderingContext2D
  createOpt: CanvasRenderingContext2DSettings
  expireAt: number
  stack?: string | null
}

const EXPIRE_TIME = 1000 * 60

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
      lend.expireAt = Date.now() + EXPIRE_TIME
      setCanvasSize(lend.ctx.canvas, width, height)
      return lend.ctx
    } else {
      const entry: Allocced = retry(1, {
        trying: () => {
          return {
            used: true,
            ctx: saveRestoreHook(createContext2D(canvasOpt)),
            createOpt: canvasOpt,
            expireAt: Date.now() + EXPIRE_TIME,
            stack: new Error().stack,
          }
        },
        beforeRetry: () => this.gc(),
        onFailed: () => {
          throw new PaplicoCanvasAllocationError()
        },
      })

      setCanvasSize(entry.ctx.canvas, width, height)
      this._allocated.push(entry)
      return entry.ctx
    }
  }

  public static return(ctx: CanvasRenderingContext2D | null | undefined) {
    if (ctx == null) return

    const entry = this._allocated.find((a) => a.ctx === ctx)
    if (!entry) return

    entry.used = false
    entry.stack = null
    restoreToInitialState(entry.ctx)
  }

  public static gc() {
    const now = Date.now()
    const expired = this._allocated.filter((a) => a.expireAt < now)

    expired.forEach((a) => {
      freeingCanvas(a.ctx.canvas)
      a.ctx.canvas.remove()
      a.ctx = null!
    })

    this._allocated = this._allocated.filter((a) => !expired.includes(a))
  }
}

const SAVE_RESTORE_STATE_SYMBOL = Symbol('saveRestoreState')

type StateSafeCanvasRenderingContext2D = CanvasRenderingContext2D & {
  [SAVE_RESTORE_STATE_SYMBOL]: {
    restoration(): void
  }
}

function retry<T>(
  count: number,
  {
    trying,
    beforeRetry,
    onFailed,
  }: {
    trying: () => T
    beforeRetry: () => void
    onFailed: () => never
  },
): T {
  const __neverTypeHack: () => never = onFailed
  const errors: any[] = []

  for (let i = 0; i < count; i++) {
    try {
      return trying()
    } catch (e) {
      beforeRetry()
      errors.push(e)
    }
  }

  __neverTypeHack()
}

function saveRestoreHook(
  ctx: CanvasRenderingContext2D,
): StateSafeCanvasRenderingContext2D {
  const { save, restore } = ctx
  let saveCount = 0
  let restoreCount = 0

  ctx.save = function () {
    saveCount++
    save.call(ctx)
  }

  ctx.restore = function () {
    restoreCount++
    restore.call(ctx)
  }
  ;(ctx as StateSafeCanvasRenderingContext2D)[SAVE_RESTORE_STATE_SYMBOL] = {
    restoration() {
      if (saveCount > restoreCount) {
        while (saveCount > restoreCount) {
          ctx.restore()
          restoreCount++
        }
      } else if (saveCount < restoreCount) {
        return
      }
    },
  }

  return ctx as StateSafeCanvasRenderingContext2D
}

function restoreToInitialState(
  ctx: StateSafeCanvasRenderingContext2D,
): StateSafeCanvasRenderingContext2D {
  ctx[SAVE_RESTORE_STATE_SYMBOL]?.restoration()
  return ctx
}
