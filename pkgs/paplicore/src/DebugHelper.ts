import { createCanvas } from './Engine3_CanvasFactory'
import { setCanvasSize } from './utils'

export const logImage = async (
  img:
    | ImageBitmap
    | ImageData
    | HTMLCanvasElement
    | CanvasRenderingContext2D
    | OffscreenCanvas,
  label?: string,
  { collapsed = true }: { collapsed?: boolean } = {}
) => {
  let canvas!: HTMLCanvasElement | OffscreenCanvas
  let blobUrl: string | null = null
  let imageUrl: string | null = null

  if (img instanceof ImageBitmap) {
    canvas = createCanvas() as HTMLCanvasElement
    setCanvasSize(canvas, img.width, img.height)
    canvas.getContext('2d')!.drawImage(img, 0, 0)
  } else if (img instanceof ImageData) {
    canvas = createCanvas() as HTMLCanvasElement
    setCanvasSize(canvas, img.width, img.height)
    canvas.getContext('2d')!.putImageData(img, 0, 0)
  } else if (
    (typeof OffscreenCanvas !== 'undefined' &&
      img instanceof OffscreenCanvas) ||
    img instanceof HTMLCanvasElement ||
    img instanceof CanvasRenderingContext2D
  ) {
    canvas = 'canvas' in img ? img.canvas : img
  }

  if (
    typeof OffscreenCanvas !== 'undefined' &&
    canvas instanceof OffscreenCanvas
  ) {
    const blob = await canvas.convertToBlob({ type: 'image/png' })

    const reader = new FileReader()
    await new Promise<void>((r) => {
      reader.onload = () => {
        blobUrl = URL.createObjectURL(blob)
        imageUrl = reader.result as string
        r()
      }

      reader.readAsDataURL(blob)
    })
  } else {
    const blob = await new Promise<Blob>((r, j) =>
      (canvas as HTMLCanvasElement).toBlob(
        (b) => (b ? r(b) : j(new Error())),
        'image/png'
      )
    )

    blobUrl = URL.createObjectURL(blob)
    imageUrl = (canvas as HTMLCanvasElement).toDataURL('image/png')
  }

  const content = [
    `%cLogImage%c ${label} image log (full image in %o)`,
    'padding:2px 4px; background:linear-gradient(40deg, #f25847, #f8be12);color:#fff;border-radius:4px;',
    '',
    blobUrl,
  ]

  collapsed ? console.groupCollapsed(...content) : console.group(...content)

  console.log(
    '%c+',
    `font-size: 0px; padding: 128px; color: transparent; background: url(${imageUrl}) center/contain no-repeat; border: 1px solid #444;`
  )

  console.groupEnd()
}

if (typeof window !== 'undefined' && window !== null) {
  ;(window as any).logImage = logImage
}

export let disableLog = false

export const logLog: Console['group'] = (...args) => {
  if (disableLog) return
  console.log(...args)
}

export const logGroup: Console['group'] = (...args) => {
  if (disableLog) return
  console.group(...args)
}

export const logGroupCollapsed: Console['group'] = (...args) => {
  if (disableLog) return
  console.groupCollapsed(...args)
}

export const logGroupEnd: Console['groupEnd'] = (...args) => {
  if (disableLog) return
  console.groupEnd(...args)
}

export const logTime: Console['time'] = (...args) => {
  if (disableLog) return
  console.time(...args)
}

export const logTimeEnd: Console['timeEnd'] = (...args) => {
  if (disableLog) return
  console.timeEnd(...args)
}

export const timeSumming = (label: string, mark: string = '') => {
  let sumTime = 0
  let calls = 0
  let max = { callOf: null as number | null, time: -Infinity }
  let min = { callOf: null as number | null, time: Infinity }
  let maxDetail: any = [undefined]
  let minDetail: any = [undefined]
  let lastStartTime: number | null = null
  let times: number[] = []

  return {
    time: () => {
      lastStartTime = performance.now()
    },
    timeEnd: (...details: any[]) => {
      if (lastStartTime) {
        const time = performance.now() - lastStartTime
        sumTime += time

        times.push(time)
        calls++

        if (time >= max.time) {
          max = { callOf: calls, time }
          maxDetail = details
        }

        if (time <= min.time) {
          min = { callOf: calls, time }
          minDetail = details
        }

        lastStartTime = null
      }
    },
    log: () => {
      if (disableLog) return

      logGroupCollapsed(
        `%c🕛${mark} Time to estimate ${label}:%c ${roundString(
          sumTime
        )}ms by ${calls} calls\n[avg] ${roundString(
          sumTime / calls
        )}ms / [max] ${roundString(max.time)}ms (call of ${
          max.callOf
        }) / [min] ${roundString(min.time)}ms (call of ${max.callOf})%c`,
        'font-weight:normal;',
        'font-weight:bold;',
        ''
      )
      logLog(
        'Times',
        times.sort((a, b) => b - a)
      )
      logLog('Max detail', ...maxDetail)
      logLog('Min detail', ...minDetail)
      logGroupEnd()
    },
  }
}

const roundString = (num: number | null, digits = 3) =>
  // prettier-ignore
  num == null ? '-'
  : num === Infinity || num === -Infinity ? '-'
  : (Math.round(num * 10 ** digits) / 10 ** digits).toString()
