import { clearCanvas, freeingCanvas, setCanvasSize } from '@/utils/canvas'
import { createContext2D } from './CanvasFactory'
import { PPLCCanvasAllocationError } from '@/Errors'
import { shallowEquals } from '@paplico/shared-lib'

type AllocatedCanvasData = {
  used: boolean
  ctx: StateSafeCanvasRenderingContext2D
  createOpt: CanvasRenderingContext2DSettings
  expireAt: number
  stack?: string | null
  lastUserStack?: string | null
  readonly width: number
  readonly height: number
}

const EXPIRE_TIME = 1000 * 60

export type Canvas2DAllocator = {
  readonly allocated: AllocatedCanvasData[]
  borrow: (
    opt: {
      width: number
      height: number
      permanent?: boolean
    } & CanvasRenderingContext2DSettings,
  ) => CanvasRenderingContext2D
  return: (ctx: CanvasRenderingContext2D | null | undefined) => void
  gc: (options?: { __testOnlyForceCollectAll?: true }) => void
}

let _allocated: Array<AllocatedCanvasData> = []

const allocator: Canvas2DAllocator = {
  get allocated() {
    return _allocated
  },

  borrow: ({ width, height, permanent, ...canvasOpt }) => {
    let lend: AllocatedCanvasData | null = null

    for (const entry of _allocated) {
      const optionsMatched = shallowEquals(canvasOpt, entry.createOpt)

      if (
        !entry.used &&
        entry.ctx.canvas.width === width &&
        entry.ctx.canvas.height === height &&
        optionsMatched
      ) {
        // If size and options matched, we can reuse it.
        entry.used = true
        entry.stack = new Error().stack
        entry.expireAt = permanent ? Infinity : Date.now() + EXPIRE_TIME
        entry.ctx.save()
        clearCanvas(entry.ctx)
        return entry.ctx
      } else if (!entry.used && optionsMatched) {
        // If size unmatched but options matched, mark it a candidate for reuse
        lend = entry
      }
    }

    if (lend) {
      // Unused canvas found, lend it.
      lend.used = true
      lend.stack = new Error().stack
      lend.expireAt = Date.now() + EXPIRE_TIME
      lend.ctx.save()
      setCanvasSize(lend.ctx.canvas, width, height)
      return lend.ctx
    } else {
      // If no unused canvas found, create a new one.
      const entry: AllocatedCanvasData = retry(1, {
        trying: () => {
          const ctx = saveRestoreHook(createContext2D(canvasOpt))

          return {
            used: true,
            ctx,
            createOpt: canvasOpt,
            expireAt: Date.now() + EXPIRE_TIME,
            stack: new Error().stack,
            lastUserStack: null,
            get width() {
              return ctx.canvas.width
            },
            get height() {
              return ctx.canvas.height
            },
          }
        },
        beforeRetry: () => Canvas2DAllocator.gc(),
        onFailed: () => {
          throw new PPLCCanvasAllocationError()
        },
      })

      entry.ctx.save()
      setCanvasSize(entry.ctx.canvas, width, height)
      _allocated.push(entry)
      return entry.ctx
    }
  },

  return: (ctx: CanvasRenderingContext2D | null | undefined) => {
    if (ctx == null) return

    const entry = _allocated.find((a) => a.ctx === ctx)
    if (!entry) return

    entry.used = false
    entry.lastUserStack = entry.stack
    entry.stack = null
    restoreToInitialState(entry.ctx)
  },

  gc: (options: { __testOnlyForceCollectAll?: true } = {}) => {
    const now = Date.now()
    const expired = options.__testOnlyForceCollectAll
      ? _allocated
      : _allocated.filter((a) => !a.used && a.expireAt < now)

    expired.forEach((a) => {
      freeingCanvas(a.ctx.canvas)
      a.ctx.canvas.remove()
      a.ctx = null!
    })

    _allocated = _allocated.filter((a) => !expired.includes(a))
  },
}

export const Canvas2DAllocator: Canvas2DAllocator = Object.defineProperties(
  Object.assign(Object.create(null), allocator),
  {
    allocated: {
      enumerable: true,
      get() {
        return allocator.allocated
      },
    },
  },
)

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
  let stackCount = 0

  ctx.save = function () {
    stackCount++
    save.call(ctx)
  }

  ctx.restore = function () {
    if (stackCount < 1) return

    stackCount--

    restore.call(ctx)
  }
  ;(ctx as StateSafeCanvasRenderingContext2D)[SAVE_RESTORE_STATE_SYMBOL] = {
    restoration() {
      while (stackCount > 0) {
        ctx.restore()
        stackCount--
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
