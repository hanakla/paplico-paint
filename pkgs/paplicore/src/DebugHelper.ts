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
    'padding:2px 4px;background:linear-gradient(40deg, #f25847, #f8be12);color:#fff;border-radius:4px;',
    '',
    blobUrl,
  ]

  collapsed ? console.groupCollapsed(...content) : console.group(...content)

  console.log(
    '%c+',
    `font-size: 0px; padding: 128px; color: transparent; background: url(${imageUrl}) center/contain;`
  )

  console.groupEnd()
}

export const disableLog = true

export const logGroup: Console['group'] = disableLog
  ? () => {}
  : console.group.bind(console)

export const logGroupCollapsed: Console['group'] = disableLog
  ? () => {}
  : console.groupCollapsed.bind(console)

export const logGroupEnd: Console['groupEnd'] = disableLog
  ? () => {}
  : console.groupEnd.bind(console)

export const logTime: Console['time'] = disableLog
  ? () => {}
  : console.time.bind(console)
export const logTimeEnd: Console['timeEnd'] = disableLog
  ? () => {}
  : console.timeEnd.bind(console)

export const timeSumming = (label: string) => {
  let sumTime = 0
  let calls = 0
  let max = -Infinity
  let min = Infinity
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
        max = Math.max(max, time)
        min = Math.min(min, time)

        if (time === max) {
          maxDetail = details
        }
        if (time === min) {
          minDetail = details
        }

        lastStartTime = null
      }
    },
    log: () => {
      if (!timeSumming.enabled) return

      console.groupCollapsed(
        `%c🕛 Time to estimate ${label}:%c ${roundString(
          sumTime
        )}ms by ${calls} calls\n[avg] ${roundString(
          sumTime / calls
        )}ms / [max] ${roundString(max)}ms / [min] ${roundString(min)}ms)`,
        'font-weight:bold;',
        ''
      )
      console.log(
        'Times',
        times.sort((a, b) => b - a)
      )
      console.log('Max detail', ...maxDetail)
      console.log('Min detail', ...minDetail)
      console.groupEnd()
    },
  }
}

timeSumming.enabled = !disableLog

const roundString = (num: number, digits = 3) =>
  (Math.round(num * 10 ** digits) / 10 ** digits).toString()
