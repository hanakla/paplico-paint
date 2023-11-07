import { createImage, createImageBitmapImpl } from '@/Infra/CanvasFactory'
import { freeingCanvas, setCanvasSize } from './canvas'
import { Canvas2DAllocator } from '@/Infra/Canvas2DAllocator'

export const imageBitmapToImageData = (
  bitmap: ImageBitmap,
  {
    buffer,
    colorSpace,
  }: {
    buffer?: CanvasRenderingContext2D
    colorSpace?: PredefinedColorSpace
  } = {},
) => {
  let borrowed: CanvasRenderingContext2D | null = null

  const cx =
    buffer ??
    (borrowed = Canvas2DAllocator.borrow({
      width: bitmap.width,
      height: bitmap.height,
      colorSpace,
    }))

  try {
    if (!borrowed) {
      setCanvasSize(cx.canvas, bitmap.width, bitmap.height)
    }

    cx.drawImage(bitmap, 0, 0)
    const imageData = cx.getImageData(0, 0, bitmap.width, bitmap.height, {
      colorSpace,
    })

    if (!borrowed) freeingCanvas(cx.canvas)

    return imageData
  } finally {
    if (borrowed) {
      Canvas2DAllocator.return(borrowed)
    }
  }
}

export const imageDataToImageBitmap = (imageData: ImageData) => {
  return createImageBitmapImpl(imageData)
}

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = createImage()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}
