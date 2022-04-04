import { CompositeMode, ILayer } from './IRenderable'
import { v4 } from 'uuid'
import { assign, fakeRejectedPromise } from '../utils'
import { Filter } from './Filter'
import { Emitter } from '../Engine3_Emitter'

type Events = {
  updated: ILayer
}

export class RasterLayer extends Emitter<Events> implements ILayer {
  public readonly layerType = 'raster'

  public readonly uid: string = `rasterlayer-${v4()}`
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
  private _imageBitmapPromise: Promise<ImageBitmap> =
    fakeRejectedPromise<ImageBitmap>(new Error('bitmap not initialized'))

  /** Mark for re-rendering decision */
  protected _lastUpdatedAt = Date.now()

  public static create({ width, height }: { width: number; height: number }) {
    const layer = new RasterLayer()

    assign(layer, {
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

  public static deserialize(obj: any) {
    const layer = assign(new RasterLayer(), {
      uid: obj.uid,
      name: obj.name,
      visible: obj.visible,
      lock: obj.lock,
      compositeMode: obj.compositeMode,
      opacity: obj.opacity,
      width: obj.width,
      height: obj.height,
      x: obj.x,
      y: obj.y,
      bitmap: obj.bitmap,
      filters: obj.filters.map((filter: any) => Filter.deserialize(filter)),
    })

    layer._imageBitmapPromise = createImageBitmap(
      new ImageData(layer.bitmap, obj.width, obj.height)
    )

    return layer
  }

  protected constructor() {
    super()
  }

  // #region getter and setters

  // prettier-ignore
  // public get id() { return this.#id }

  // // prettier-ignore
  // public get name() { return this.#name }
  // // prettier-ignore
  // public set name(val: string) { this.#name = val }

  // // prettier-ignore
  // public get visible() { return this.#visible }
  // // prettier-ignore
  // public set visible(val: boolean) { this.#visible = val }

  // // prettier-ignore
  // public get lock() { return this.#lock }
  // // prettier-ignore
  // public set lock(val: boolean) { this.#lock = val }

  // // prettier-ignore
  // public get compositeMode() { return this.#compositeMode }
  // // prettier-ignore
  // public set compositeMode(val: CompositeMode) { this.#compositeMode = val }

  // // prettier-ignore
  // public get opacity() { return this.#opacity }
  // // prettier-ignore
  // public set opacity(val: number) { this.#opacity = val }

  // // prettier-ignore
  // public get width() { return this.#width }
  // // prettier-ignore
  // public set width(val: number) { this.#width = val }

  // // prettier-ignore
  // public get height() { return this.#height }
  // // prettier-ignore
  // public set height(val: number) { this.#height = val }

  // // prettier-ignore
  // public get x() { return this.#x }
  // // prettier-ignore
  // public set x(val: number) { this.#x = val }

  // // prettier-ignore
  // public get y() { return this.#y }
  // // prettier-ignore
  // public set y(val: number) { this.#y = val }

  // // prettier-ignore
  // public get filters() { return this.#filters }
  // prettier-ignore
  // public set filters(val: D) { this.#filters = val }

  // #endregion

  public get imageBitmap(): Promise<ImageBitmap> {
    return this._imageBitmapPromise
  }

  public get lastUpdatedAt() {
    return this._lastUpdatedAt
  }

  public update(proc: (layer: this) => void) {
    proc(this)
    this._lastUpdatedAt = Date.now()
    this.emit('updated', this)
  }

  public async updateBitmap(
    process: (bitmap: Uint8ClampedArray, layer: RasterLayer) => void
  ) {
    process(this.bitmap, this)

    this._imageBitmapPromise = createImageBitmap(
      new ImageData(this.bitmap, this.width, this.height)
    )

    this.emit('updated', this)
  }

  public serialize() {
    return {
      layerType: this.layerType,
      uid: this.uid,
      name: this.name,
      visible: this.visible,
      lock: this.lock,
      compositeMode: this.compositeMode,
      opacity: this.opacity,
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
      filters: this.filters.map((f) => f.serialize()),
      bitmap: this.bitmap,
    }
  }
}
