import { ILayer } from './IRenderable'
import { v4 } from 'uuid'
import { fakeRejectedPromise } from '../utils'
import { Filter } from './Filter'

export class RasterLayer implements ILayer {
  public readonly layerType = 'raster'

  public readonly id: string = `rasterlayer-${v4()}`
  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeMode: ILayer['compositeMode'] = 'normal' as const
  public opacity: number = 100

  public width: number = 0
  public height: number = 0
  public x: number = 0
  public y: number = 0
  public filters: Filter[] = []

  public readonly bitmap: Uint8ClampedArray = null as any
  private _imageBitmapPromise: Promise<ImageBitmap> = fakeRejectedPromise(
    new Error('bitmap not initialized')
  )

  /** Mark for re-rendering decision */
  protected _lastUpdatedAt = Date.now()

  public static create({ width, height }: { width: number; height: number }) {
    const layer = new RasterLayer()

    Object.assign(layer, {
      bitmap: new Uint8ClampedArray(width * height * 4),
      width: width,
      height: height,
    })

    if (process.env.NODE_ENV !== 'test') {
      layer._imageBitmapPromise = createImageBitmap(
        new ImageData(layer.bitmap, width, height)
      )
    } else {
      layer._imageBitmapPromise = Promise.resolve(null as any)
    }

    return layer
  }

  protected constructor() {}

  public get imageBitmap(): Promise<ImageBitmap> {
    return this._imageBitmapPromise
  }

  public get lastUpdatedAt() {
    return this._lastUpdatedAt
  }

  public update(this: this, proc: (layer: RasterLayer) => void) {
    proc(this)
    this._lastUpdatedAt = Date.now()
  }

  public async updateBitmap(
    process: (bitmap: Uint8ClampedArray, layer: RasterLayer) => void
  ) {
    process(this.bitmap, this)

    this._imageBitmapPromise = createImageBitmap(
      new ImageData(this.bitmap, this.width, this.height)
    )
  }

  public serialize() {
    return {
      id: this.id,
      name: this.name,
      visible: this.visible,
      lock: this.lock,
      compositeMode: this.compositeMode,
      opacity: this.opacity,
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
      // bitmap: this.bitmap,
    }
  }
}
