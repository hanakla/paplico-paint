import { PaplicoDocument } from '@/Document/Document'
import { RuntimeLayerEntity } from './RuntimeDocument/RuntimeLayerEntity'

const cancelIdle =
  typeof cancelIdleCallback !== 'undefined'
    ? cancelIdleCallback
    : (clearTimeout as typeof window['clearTimeout'])
const requestIdle =
  typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (setTimeout as typeof window['setTimeout'])

export namespace RuntimeDocument {
  export type LayoutData = {
    left: number
    top: number
    width: number
    height: number
  }
}

export class RuntimeDocument {
  public document: PaplicoDocument
  public layerImageCache: Map<string, ImageBitmap> = new Map()
  public blobCaches: Map<string, WeakRef<any>> = new Map()
  protected writebackCallbackIds = new Map<string, number>()
  protected layoutData = new Map<string, RuntimeDocument.LayoutData>()

  protected layerEntities = new Map<string, RuntimeLayerEntity>()

  constructor(document: PaplicoDocument) {
    this.document = document
    this.document.layerEntities.forEach((l) => {
      this.layerEntities.set(l.uid, {
        lastUpdated: 0,
        ...l,
      })
    })
  }

  public get rootNodes() {
    return this.document.layerTree
  }

  public resolveLayer(uid: string) {
    return this.layerEntities.get(uid)
  }

  /** Check valid bitmap cache in requested size availablity */
  public hasLayerBitmapCache(
    layerUid: string,
    size: { width: number; height: number }
  ) {
    const layer = this.document.layerEntities.find((l) => l.uid === layerUid)
    if (!layer) return false

    const bitmap = this.layerImageCache.get(layerUid)
    if (!bitmap) return false

    if (layer.layerType === 'vector') {
      return bitmap.width === size.width && bitmap.height === size.height
    }

    return true
  }

  public async getOrCreateLayerBitmapCache(
    layerUid: string,
    size?: { width: number; height: number }
  ) {
    const layer = this.document.layerEntities.find((l) => l.uid === layerUid)
    if (!layer) return null

    if (layer?.layerType !== 'raster' && !size) {
      throw new Error(
        'Cannot create bitmap cache without size when layer is not raster'
      )
    }

    let bitmap = this.layerImageCache.get(layerUid)

    // if different size needed in vector layer, dispose current cache
    if (
      layer.layerType === 'vector' &&
      (bitmap?.width !== size?.width || bitmap?.height !== size?.height)
    ) {
      bitmap?.close()
      bitmap = void 0
    }

    if (bitmap) return bitmap

    if (layer.layerType === 'raster') {
      bitmap = await createImageBitmap(
        layer.bitmap
          ? new ImageData(layer.bitmap, layer.width, layer.height)
          : new ImageData(layer.width, layer.height)
      )
      this.layerImageCache.set(layerUid, bitmap)
    } else if (layer.layerType === 'vector') {
      bitmap = await createImageBitmap(new ImageData(size!.width, size!.height))
      this.layerImageCache.set(layerUid, bitmap)
    }

    return bitmap
  }

  // public getLayerImageBitmap(layerUid: string) {}

  public async updateLayerBitmapCache(layerUid: string, newBitmap: ImageData) {
    const layer = this.document.layerEntities.find((l) => l.uid === layerUid)
    if (layer?.layerType !== 'raster') return null

    const bitmap = this.layerImageCache.get(layerUid)
    bitmap?.close()

    layer.bitmap = newBitmap.data
    this.layerImageCache.set(layerUid, await createImageBitmap(newBitmap))
  }

  public setBlobCache<T extends object = any>(uid: string, value: T) {
    this.blobCaches.set(uid, new WeakRef(value))
  }

  public getBlobCache<T extends object = any>(uid: string): T | undefined {
    const ref = this.blobCaches.get(uid)
    if (ref == null) return undefined
    return ref.deref() as T | undefined
  }

  public setLayerLayoutData(
    layerUid: string,
    data: RuntimeDocument.LayoutData
  ) {
    const layer = this.document.layerEntities.find((l) => l.uid === layerUid)
    if (!layer) return

    this.layoutData.set(layer?.uid, data)
  }

  public getLayerLayoutData(layerUid: string) {
    const layer = this.document.layerEntities.find((l) => l.uid === layerUid)
    if (!layer) return

    return this.layoutData.get(layer?.uid)
  }
}