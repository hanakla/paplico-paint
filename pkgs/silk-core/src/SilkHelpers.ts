import type { CompositeMode } from './SilkDOM/ILayer'
import type * as SilkDOM from './SilkDOM/index'
import { RasterLayer } from './SilkDOM/RasterLayer'
import { createContext2D } from './Engine3_CanvasFactory'
import { ColorStop } from './Value'
import { assign, setCanvasSize } from './utils'

export async function imageToLayer(img: HTMLImageElement) {
  const layer = RasterLayer.create({
    width: img.width,
    height: img.height,
  })
  const context = createContext2D()
  setCanvasSize(context.canvas, {
    width: img.width,
    height: img.height,
  })

  context.imageSmoothingEnabled = false
  context.drawImage(img, 0, 0)
  layer.bitmap.set(await context.getImageData(0, 0, img.width, img.height).data)

  return layer
}

export function mapPoints<T>(
  points: SilkDOM.Path.PathPoint[],
  proc: (
    point: SilkDOM.Path.PathPoint,
    prevPoint: SilkDOM.Path.PathPoint | undefined,
    index: number,
    points: SilkDOM.Path.PathPoint[]
  ) => T,
  { startOffset = 0 }: { startOffset?: number } = {}
): T[] {
  // const result: T[] = [] as any
  return points
    .slice(startOffset)
    .map((point, idx) =>
      proc(point, points[idx + startOffset - 1], idx, points)
    )
}

export function sortColorStopsByPositionAsc(colorStops: ColorStop[]) {
  return colorStops.sort((a, b) => a.position - b.position)
}

export function validCompositeMode(value: string): value is CompositeMode {
  return (
    value === 'normal' ||
    value === 'multiply' ||
    value === 'screen' ||
    value === 'overlay'
  )
}

export function workerSafeCanvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  { type, quality }: { type: string; quality?: number }
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type, quality })
  } else {
    return new Promise<Blob>((resolver) => {
      canvas.toBlob(
        (blob) => {
          resolver(blob!)
        },
        type,
        quality
      )
    })
  }
}
