import { PaplicoDocument } from '@/Document/Document'
import { AtomicResource } from '@/utils/AtomicResource'
import { RuntimeLayerEntity } from './RuntimeLayerEntity'
import { History } from '@/History/History'
import { ICommand } from '@/History/ICommand'
import { PreviewStore } from '@/Engine/DocumentContext/PreviewStore'
import { Emitter } from '@/utils/Emitter'
import { LayerMetrics } from './LayerMetrics'
import { VectorGroup, VectorObject } from '@/Document'
import { createImageBitmapImpl, createImageData } from '../CanvasFactory'

export namespace DocumentContext {
  export type LayoutData = {
    left: number
    top: number
    width: number
    height: number
  }

  export type Events = {
    'preview:updated': PreviewStore.Events['updated']
  }
}

export class DocumentContext extends Emitter<DocumentContext.Events> {
  public document: PaplicoDocument
  public history: History

  public layerImageCache: Map<string, ImageBitmap> = new Map()
  public blobCaches: Map<string, WeakRef<any>> = new Map()

  public layerMetrics = new LayerMetrics(this)

  protected layerEntities = new Map<string, RuntimeLayerEntity>()
  protected vectorObjectEntities = new Map<string, VectorObject | VectorGroup>()

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
    this.layerMetrics.dispose()
    this.layerImageCache.forEach((bitmap) => bitmap.close())
    this.layerImageCache.clear()
    this.blobCaches.clear()
  }

  public get rootNode() {
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

  public resolveVectorObject(uid: string) {
    return this.document.resolveVectorObject(uid)
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

    const runtimeEntity = this.layerEntities.get(layerUid) ?? {
      lastUpdated: 0,
      source: new WeakRef(layer),
    }
    this.layerEntities.set(layerUid, runtimeEntity)

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
      bitmap = await createImageBitmapImpl(
        layer.bitmap
          ? createImageData(layer.bitmap, layer.width, layer.height)
          : createImageData(layer.width, layer.height),
      )

      runtimeEntity.lastUpdated = Date.now()

      this.layerImageCache.set(layerUid, bitmap)
      await this.previews.generateAndSet(layerUid, bitmap)
    } else if (layer.layerType === 'vector') {
      bitmap = await createImageBitmapImpl(
        createImageData(size!.width, size!.height),
      )

      runtimeEntity.lastUpdated = Date.now()

      this.layerEntities.set(layerUid, runtimeEntity)
      this.layerImageCache.set(layerUid, bitmap)
      await this.previews.generateAndSet(layerUid, bitmap)
    }

    return bitmap
  }

  public invalidateLayerBitmapCache(layerUid: string) {
    this.layerImageCache.delete(layerUid)
  }

  public invalidateAllLayerBitmapCache() {
    this.layerImageCache.forEach((bitmap) => bitmap.close())
    this.layerImageCache.clear()
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

    const nextBitmap = await createImageBitmapImpl(newBitmap)
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

  public updateObjectMetrics(metrices: Record<string, LayerMetrics.BBoxSet>) {
    const entries = Object.entries(metrices)

    for (let idx = 0, l = entries.length; idx < l; idx++) {
      const [uid, data] = entries[idx]
      this.layerMetrics.setEntityMetrice(uid, data.source, data.visually)
    }
  }

  public updateLayerMetrics(metrices: Record<string, LayerMetrics.BBoxSet>) {
    const entries = Object.entries(metrices)

    for (let idx = 0, l = entries.length; idx < l; idx++) {
      const [uid, data] = entries[idx]
      this.layerMetrics.setEntityMetrice(uid, data.source, data.visually)
    }
  }

  public getLayerMetrics(layerUid: string) {
    const layer = this.document.layerEntities.find((l) => l.uid === layerUid)
    if (!layer) return

    return this.layerMetrics.get(layer?.uid)
  }
}
