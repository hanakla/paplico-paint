import { createImageBitmapImpl, createImageData } from '@/Engine/CanvasFactory'
import { Canvas2DAllocator } from '@/Engine/Canvas2DAllocator'
import { freeingCanvas, setCanvasSize } from '@/utils/canvas'
import { unreachable } from '@/utils/unreachable'

type CropPosition = {
  x: 'left' | 'center' | 'right'
  y: 'top' | 'bottom' | 'center'
}

type ResizeOption = {
  width: number
  height: number
  toWidth: number
  toHeight: number
  bufferCanvas?: HTMLCanvasElement
} & (
  | {
      method: 'resize'
    }
  | {
      method: 'crop'
      positon: CropPosition
    }
)

/**
 * Resizing image
 * @param data sourceImage
 */
export const resize = async (
  data: Uint8ClampedArray | ImageData,
  { bufferCanvas, ...opt }: ResizeOption,
): Promise<ImageData> => {
  const image: ImageBitmap =
    data instanceof ImageData
      ? await createImageBitmapImpl(data)
      : await createImageBitmapImpl(
          createImageData(data, opt.width, opt.height),
        )

  let borrowed: CanvasRenderingContext2D | null = null
  const canv =
    bufferCanvas ??
    (borrowed = Canvas2DAllocator.borrow({
      width: opt.toWidth,
      height: opt.toHeight,
    })).canvas

  if (bufferCanvas) setCanvasSize(canv, opt.toWidth, opt.toHeight)

  const ctx = canv.getContext('2d')!

  if (opt.method === 'resize') {
    ctx.drawImage(image, 0, 0)
  } else if (opt.method === 'crop') {
    // prettier-ignore
    const pos = calcDrawPosition(opt)
    ctx.drawImage(image, pos.x, pos.y)
  }

  const reuslt = ctx.getImageData(0, 0, opt.toWidth, opt.toHeight)

  freeingCanvas(canv)
  Canvas2DAllocator.release(borrowed)
  return reuslt
}

function calcDrawPosition(opt: ResizeOption) {
  if (opt.method !== 'crop')
    throw new Error('Unexpected method in calcDrawPosition')

  // prettier-ignore
  return {
    x: opt.positon.x === 'left' ? 0
      : opt.positon.x === 'center' ? (opt.toWidth - opt.width) / 2
      : opt.positon.x === 'right' ? opt.toWidth - opt.width
      : unreachable(opt.positon.x),
    y: opt.positon.y === 'top' ? 0
      : opt.positon.y === 'center' ? (opt.toHeight - opt.height) / 2
      : opt.positon.y === 'bottom' ? opt.toHeight - opt.height
      : unreachable(opt.positon.y),
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest!

  describe('resize', () => {
    it.each([
      { x: 'left', y: 'top', expected: { x: 0, y: 0 } },
      { x: 'left', y: 'center', expected: { x: 0, y: 45 } },
      { x: 'left', y: 'bottom', expected: { x: 0, y: 90 } },
      { x: 'center', y: 'top', expected: { x: 45, y: 0 } },
      { x: 'center', y: 'center', expected: { x: 45, y: 45 } },
      { x: 'center', y: 'bottom', expected: { x: 45, y: 90 } },
      { x: 'right', y: 'top', expected: { x: 90, y: 0 } },
      { x: 'right', y: 'center', expected: { x: 90, y: 45 } },
      { x: 'right', y: 'bottom', expected: { x: 90, y: 90 } },
    ] satisfies Array<CropPosition & { expected: { x: number; y: number } }>)(
      'crop by %p',
      (positon) => {
        expect(
          calcDrawPosition({
            width: 10,
            height: 10,
            toWidth: 100,
            toHeight: 100,
            method: 'crop',
            positon,
          }),
        ).toMatchObject(positon.expected)
      },
    )
  })
}
