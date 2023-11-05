import { VectorLayer } from '@/Document/LayerEntity'
import { Canvas2DAllocator } from '@/Engine/Canvas2DAllocator'
import { lerp, clampNumInLength, clamp } from '@/math-utils'

export function remapStrokeWeights(
  map: HTMLCanvasElement | ImageBitmap,
  vectorLayer: VectorLayer,
) {
  const buf = Canvas2DAllocator.borrow({
    width: map.width,
    height: map.height,
    willReadFrequently: true,
  })

  const imageData = buf.getImageData(0, 0, map.width, map.height)
  const imageLerp = createImageDataLerp(imageData)

  const patches: Array<{
    path: string[]
    objectUid: string
    pointPatches: [idx: number, newWeight: number][]
  }> = []

  for (const object of vectorLayer.objects) {
    if (object.type !== 'vectorObject') continue

    const path = object.path
    const pointPatches: [idx: number, newWeight: number][] = []

    for (const [idx, point] of path.points.entries()) {
      const { x, y } = point
      const [r, g, b, a] = imageLerp.atPosition(x, y)

      const newWeight = (a / 255) * 2
      pointPatches.push([idx, newWeight])
    }

    patches.push({
      path: path.path,
      objectUid: object.uid,
      pointPatches,
    })
  }
}

function createImageDataLerp(image: ImageData) {
  const atFloatPosition = (x: number, y: number) => {
    const rateX = x - Math.trunc(x)
    const rateY = y - Math.trunc(y)

    const indexX = Math.trunc(x)
    const indexY = Math.trunc(y)

    const aIdx = indexX + indexY * image.width
    const bIdx = indexX + 1 + indexY * image.width
    const cIdx = indexX + (indexY + 1) * image.width
    const dIdx = indexX + 1 + (indexY + 1) * image.width

    const a = image.data.slice(aIdx, 4)
    const b = image.data.slice(bIdx, 4)
    const c = image.data.slice(cIdx, 4)
    const d = image.data.slice(dIdx, 4)

    const ab = [
      lerp(a[0], b[0], rateX),
      lerp(a[1], b[1], rateX),
      lerp(a[2], b[2], rateX),
      lerp(a[3], b[3], rateX),
    ]

    const cd = [
      lerp(c[0], d[0], rateX),
      lerp(c[1], d[1], rateX),
      lerp(c[2], d[2], rateX),
      lerp(c[3], d[3], rateX),
    ]

    const abcd = [
      lerp(ab[0], cd[0], rateY),
      lerp(ab[1], cd[1], rateY),
      lerp(ab[2], cd[2], rateY),
      lerp(ab[3], cd[3], rateY),
    ]

    return abcd
  }

  return {
    atPosition: (x: number, y: number) => {
      return atFloatPosition(x, y)
    },
  }
}
