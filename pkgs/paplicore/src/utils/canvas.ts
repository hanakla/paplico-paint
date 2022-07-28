export const saveAndRestoreCanvas = <
  C extends CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  T extends (ctx: C) => any
>(
  ctx: C,
  proc: T
): ReturnType<T> => {
  try {
    ctx.save()
    return proc(ctx)
  } catch (e) {
    throw e
  } finally {
    ctx.restore()
  }
}

const CANVAS_PROXY_SETTINGS: ProxyHandler<HTMLCanvasElement | OffscreenCanvas> =
  {
    get(target, prop) {
      if (prop === 'getContext') {
        return (type: string, ...args: any[]) => {
          if (type === '2d') {
            let ctx = target.getContext('2d', ...args)
            if (ctx == null) return null

            return new Proxy(ctx, RENDERING_CONTEXT_2D_PROXY_SETTINGS)
          } else {
            return target.getContext(type as any, ...args)
          }
        }
      }
    },
    set(target, prop, value) {
      throw new Error(
        `Canvas is read-only. ${prop as any} is not allowed on Readonly canvas`
      )
    },
  }

const RENDERING_CONTEXT_2D_PROXY_SETTINGS: ProxyHandler<
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
> = {
  get(target, prop: keyof CanvasRenderingContext2D) {
    const disallowKeys: (keyof CanvasRenderingContext2D)[] = [
      'drawImage',
      'fillRect',
      'fillText',
      'strokeText',
      'stroke',
      'strokeRect',
    ]

    if (disallowKeys.includes(prop)) {
      throw new Error(
        `Canvas is read-only. ${prop} is not allowed on Readonly canvas`
      )
    }

    return Reflect.get(target, prop)
  },
  set(target, prop: keyof CanvasRenderingContext2D, value) {
    // const disallowKeys: (keyof CanvasRenderingContext2D)[] =['fillStyle','strokeStyle', 'globalAlpha', 'globalCompositeOperation',"textAlign","textBaseline"]
    // if (disallowKeys.includes(prop)) {
    throw new Error(
      `Canvas is read-only. ${prop} is not allowed on Readonly canvas`
    )
    // }

    // return Reflect.set(target, prop, value)
  },
}

export const makeReadOnlyRenderingContext = <
  C extends CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
>(
  ctx: C
): C => {
  return new Proxy(ctx, RENDERING_CONTEXT_2D_PROXY_SETTINGS) as C
}

export const makeReadOnlyCanvas = <
  C extends HTMLCanvasElement | OffscreenCanvas
>(
  canvas: C
): C => {
  // const DISALLOW_CANVAS_PROPS: (string | symbol)[] = ['width', 'height']

  return new Proxy(canvas, CANVAS_PROXY_SETTINGS) as C
}
