import { CompositeMode, ILayer } from './ILayer'
import { v4 } from 'uuid'
import { fakeRejectedPromise } from '../utils'
import { assign, pick } from '../utils/object'
import { Filter } from './Filter'
import { Emitter } from '../Engine3_Emitter'
import * as featureTag from './internal/featureTag'
import { Requiring } from '../utils/types'

type Events = {
  updated: ILayer
}

export declare namespace RasterLayer {
  export type Attributes = ILayer.Attributes & {
    width: number
    height: number
  }

  export type PatchableAttributes = Omit<Attributes, 'uid' | 'layerType'>
}

export class RasterLayer extends Emitter<Events> implements ILayer {
  public static readonly patchableAttributes: readonly (keyof RasterLayer.PatchableAttributes)[] =
    Object.freeze([
      'name',
      'visible',
      'lock',
      'compositeMode',
      'opacity',

      'width',
      'height',
      'x',
      'y',

      'features',
    ])

  public readonly layerType = 'raster'

  public readonly uid: string = `rasterlayer-${v4()}`
  public name: string = ''
  public visible: boolean = true
  public lock: boolean = false
  public compositeMode: CompositeMode = 'normal' as const
  public opacity: number = 100

  public width: number = 0
  public height: number = 0
  public x: number = 0
  public y: number = 0

  public readonly filters: Filter[] = []
  public readonly features = Object.create(null)

  public readonly bitmap: Uint8ClampedArray = null as any
  private _imageBitmapPromise: Promise<ImageBitmap> =
    fakeRejectedPromise<ImageBitmap>(new Error('bitmap not initialized'))

  /** Mark for re-rendering decision */
  protected _lastUpdatedAt = Date.now()

  public static create(
    attrs: Requiring<
      Partial<RasterLayer.PatchableAttributes>,
      'width' | 'height'
    >
  ): RasterLayer {
    const layer = new RasterLayer()

    assign(layer, {
      bitmap: new Uint8ClampedArray(attrs.width * attrs.height * 4),
      ...pick(attrs, RasterLayer.patchableAttributes),
    })

    if (process.env.NODE_ENV !== 'test') {
      layer._imageBitmapPromise = createImageBitmap(
        new ImageData(layer.bitmap, attrs.width, attrs.height)
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
      features: obj.features,
    })

    layer._imageBitmapPromise = createImageBitmap(
      new ImageData(layer.bitmap, obj.width, obj.height)
    )

    return layer
  }

  protected constructor() {
    super()
  }

  public hasFeature = featureTag.hasFeature
  public enableFeature = featureTag.enableFeature
  public getFeatureSetting = featureTag.getFeatureSetting
  public patchFeatureSetting = featureTag.patchFeatureSetting

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
    process: (
      bitmap: Uint8ClampedArray,
      layer: RasterLayer,
      replaceBitmap: (
        bitmap: Uint8ClampedArray,
        newSize: { width: number; height: number }
      ) => void
    ) => void
  ) {
    process(this.bitmap, this, (bitmap, newSize) => {
      Object.assign(this, { bitmap, ...pick(newSize, ['width', 'height']) })
    })

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
      features: this.features,
    }
  }

  public clone(): this {
    return RasterLayer.deserialize(
      assign(this.serialize(), {
        uid: `rasterlayer-${v4()}`,
        bitmap: new Uint8ClampedArray(this.bitmap),
      })
    ) as this
  }
}
