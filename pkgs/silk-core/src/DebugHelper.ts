import { createCanvas } from './Engine3_CanvasFactory'
import { setCanvasSize } from './utils'

export const logImage = async (
  img:
    | ImageBitmap
    | ImageData
    | HTMLCanvasElement
    | CanvasRenderingContext2D
    | OffscreenCanvas,
  label?: string
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
    img instanceof OffscreenCanvas ||
    img instanceof HTMLCanvasElement ||
    img instanceof CanvasRenderingContext2D
  ) {
    canvas = 'canvas' in img ? img.canvas : img
  }

  if (canvas instanceof OffscreenCanvas) {
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
    imageUrl = canvas.toDataURL('image/png')
  }

  console.groupCollapsed(
    `%cLogImage%c ${label} image log (full image in %o)`,
    'padding:2px 4px;background:linear-gradient(40deg, #f25847, #f8be12);color:#fff;border-radius:4px;',
    '',
    blobUrl
  )

  console.log(
    '%c+',
    `font-size: 0px; padding: 128px; color: transparent; background: url(${imageUrl}) center/contain;`
  )

  console.groupEnd()
}
