import { PaplicoDocument } from '@/Document/Document'
import { AtomicResource } from '@/utils/AtomicResource'
import { RuntimeLayerEntity } from './RuntimeDocument/RuntimeLayerEntity'
import { History } from '@/History/History'
import { ICommand } from '@/History/ICommand'
import { PreviewStore } from '@/Engine/PreviewStore'
import { Emitter } from '@/utils/Emitter'

const cancelIdle =
  typeof cancelIdleCallback !== 'undefined'
    ? cancelIdleCallback
    : (clearTimeout as (typeof window)['clearTimeout'])

const requestIdle =
  typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (setTimeout as (typeof window)['setTimeout'])

export namespace RuntimeDocument {
  export type LayoutData = {
    left: number
    top: number
    width: number
    height: number
  }
}

export namespace RuntimeDocument {
  export type Events = {
    'preview:updated': PreviewStore.Events['updated']
  }
}

export class RuntimeDocument extends Emitter<RuntimeDocument.Events> {
  public document: PaplicoDocument
  public history: History

  public layerImageCache: Map<string, ImageBitmap> = new Map()
  public blobCaches: Map<string, WeakRef<any>> = new Map()

  protected layoutData = new Map<string, RuntimeDocument.LayoutData>()
  protected layerEntities = new Map<string, RuntimeLayerEntity>()

  public previews: PreviewStore

  public updaterLock = new AtomicResource({}, 'RuntimeDocument#updateLock')

  constructor(document: PaplicoDocument) {
    super()

    this.previews = new PreviewStore()
    this.previews.on('updated', (entry) => {
      this.emit('preview:updated', entry)
    })

    this.document = document
    this.history = new History()
  }

  public dispose() {
    this.mitt.all.clear()
    this.updaterLock.clearQueue()

    this.previews.dispose()
    this.history.dispose()
    this.layerImageCache.forEach((bitmap) => bitmap.close())
    this.layerImageCache.clear()
    this.layoutData.clear()
    this.blobCaches.clear()
  }

  public get rootNodes() {
    return this.document.layerTree
  }

  public command = {
    do: (command: ICommand) => this.history.do(this, command),
    undo: () => this.history.undo(this),
    redo: () => this.history.redo(this),
    canUndo: () => this.history.canUndo(),
    canRedo: () => this.history.canRedo(),
  }

  public getPreviewImage(layerUid: string) {
    return this.previews.get(layerUid)
  }

  public resolveLayer(uid: string) {
    let runtimeEntity = this.layerEntities.get(uid)
    if (runtimeEntity) return runtimeEntity

    const layer = this.document.resolveLayerEntity(uid)
    if (!layer) return undefined

    runtimeEntity = {
      lastUpdated: 0,
      source: new WeakRef(layer),
    }

    this.layerEntities.set(uid, runtimeEntity)
    return runtimeEntity
  }

  /** Check valid bitmap cache in requested size availablity */
  public hasLayerBitmapCache(
    layerUid: string,
    size: { width: number; height: number },
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

  public getLayerBitmapCache(layerUid: string) {
    return this.layerImageCache.get(layerUid)
  }

  public async getOrCreateLayerBitmapCache(
    layerUid: string,
    size?: { width: number; height: number },
  ) {
    const layer = this.document.layerEntities.find((l) => l.uid === layerUid)
    if (!layer) return null

    if (layer?.layerType !== 'raster' && !size) {
      throw new Error(
        'Cannot create bitmap cache without size when layer is not raster',
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
          : new ImageData(layer.width, layer.height),
      )

      this.layerImageCache.set(layerUid, bitmap)
      await this.previews.generateAndSet(layerUid, bitmap)
    } else if (layer.layerType === 'vector') {
      bitmap = await createImageBitmap(new ImageData(size!.width, size!.height))
      this.layerImageCache.set(layerUid, bitmap)
      await this.previews.generateAndSet(layerUid, bitmap)
    }

    return bitmap
  }

  public invalidateLayerBitmapCache(layerUid: string) {
    this.layerImageCache.delete(layerUid)
  }

  // public getLayerImageBitmap(layerUid: string) {}

  public async updateOrCreateLayerBitmapCache(
    layerUid: string,
    newBitmap: ImageData,
  ) {
    const layer = this.document.layerEntities.find((l) => l.uid === layerUid)

    const bitmap = this.layerImageCache.get(layerUid)
    bitmap?.close()

    if (layer?.layerType === 'raster') {
      layer.bitmap = newBitmap.data
    }

    const nextBitmap = await createImageBitmap(newBitmap)
    this.layerImageCache.set(layerUid, nextBitmap)
    this.previews.generateAndSet(layerUid, nextBitmap)

    return nextBitmap
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
    data: RuntimeDocument.LayoutData,
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
