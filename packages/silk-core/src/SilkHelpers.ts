import { CompositeMode } from 'Entity/IRenderable'
import * as SilkEntity from './Entity/index'

export async function imageToLayer(img: HTMLImageElement) {
  const layer = SilkEntity.RasterLayer.create({
    width: img.width,
    height: img.height,
  })
  const context = Object.assign(document.createElement('canvas'), {
    width: img.width,
    height: img.height,
  }).getContext('2d')!

  context.imageSmoothingEnabled = false
  context.drawImage(img, 0, 0)
  layer.bitmap.set(await context.getImageData(0, 0, img.width, img.height).data)

  return layer
}

export function mapPoints<T>(
  points: SilkEntity.Path.PathPoint[],
  proc: (
    point: SilkEntity.Path.PathPoint,
    prevPoint: SilkEntity.Path.PathPoint | undefined,
    index: number,
    points: SilkEntity.Path.PathPoint[]
  ) => T,
  { startOffset = 0 }: { startOffset?: number } = {}
): T[] {
  const result: T[] = [] as any

  for (let idx = startOffset, l = points.length; idx < l; idx++) {
    result.push(proc(points[idx], points[idx - 1], idx, points))
  }

  return result
}

export function validCompositeMode(value: string): value is CompositeMode {
  return (
    value === 'normal' ||
    value === 'multiply' ||
    value === 'screen' ||
    value === 'overlay'
  )
}
