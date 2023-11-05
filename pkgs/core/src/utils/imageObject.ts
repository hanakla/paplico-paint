import {
  createCanvas,
  createImage,
  createImageBitmapImpl,
} from '@/Engine/CanvasFactory'
import { freeingCanvas, setCanvasSize } from './canvas'

export const imageBitmapToImageData = (
  bitmap: ImageBitmap,
  { buffer }: { buffer?: HTMLCanvasElement } = {},
) => {
  const canvas = buffer ?? createCanvas()
  setCanvasSize(canvas, bitmap.width, bitmap.height)

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)

  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  freeingCanvas(canvas)

  return imageData
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
