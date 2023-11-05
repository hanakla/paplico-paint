import { PaplicoDocument } from '@/Document/Document'
import { AtomicResource } from '@/utils/AtomicResource'
import { RuntimeLayerEntity } from './RuntimeLayerEntity'
import { History } from '@/History/History'
import { ICommand } from '@/History/ICommand'
import { PreviewStore } from '@/Engine/DocumentContext/PreviewStore'
import { Emitter } from '@/utils/Emitter'
import { LayerMetrics } from './LayerMetrics'
import { VectorObject, VisuElement } from '@/Document'
import { createImageBitmapImpl, createImageData } from '../CanvasFactory'

export namespace DocumentContext {
  export type VisuallyPointer = {
    lastUpdated: number
    source: WeakRef<VisuElement.AnyElement>
  }

  export type LayoutData = {
    left: number
    top: number
    width: number
    height: number
  }

  export type ActiveLayer = {
    visuType: VisuElement.AnyElement['type']
    layerUid: string
    pathToLayer: string[]
  }

  export type Events = {
    invalidateVectorPathCacheRequested: {
      object: VectorObject
    }
    activeLayerChanged: {
      current: ActiveLayer | null
    }
    'preview:updated': PreviewStore.Events['updated']
  }
}

export class DocumentContext extends Emitter<DocumentContext.Events> {
  public document: PaplicoDocument
  public history: History

  public layerImageCache: Map<string, ImageBitmap> = new Map()
  public blobCaches: Map<string, WeakRef<any>> = new Map()

  public layerMetrics = new LayerMetrics(this)
  protected visuElements = new Map<string, DocumentContext.VisuallyPointer>()
  public previews: PreviewStore

  public updaterLock = new AtomicResource({}, 'RuntimeDocument#updateLock')

  protected _activeVisually: DocumentContext.ActiveLayer | null = null
  protected _activeVisuallyEntity: VisuElement.AnyElement | null = null

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
    this._activeVisually = null
    this._activeVisuallyEntity = null

    this.mitt.all.clear()
    this.updaterLock.clearQueue()

    this.previews.dispose()
    this.history.dispose()
    this.layerMetrics.dispose()
    this.layerImageCache.forEach((bitmap) => bitmap.close())
    this.layerImageCache.clear()
    this.blobCaches.clear()
  }

  public get layerTreeRoot() {
    return this.document.layerTreeRoot
  }

  public command = {
    do: (command: ICommand) => this.history.do(this, command),
    undo: () => this.history.undo(this),
    redo: () => this.history.redo(this),
    canUndo: () => this.history.canUndo(),
    canRedo: () => this.history.canRedo(),
  }

  public get activeLayer() {
    return this._activeVisually
  }

  public get activeVisuallyEntity() {
    return this._activeVisuallyEntity
  }

  public setStrokeTargetVisually(
    path: string[] | null | undefined,
    {
      __internal_skipEmit,
    }: {
      __internal_skipEmit?: boolean
    } = {},
  ) {
    if (!path || path.length === 0) {
      this._activeVisually = null
      this._activeVisuallyEntity = null
      this.emit('activeLayerChanged', { current: null })
      return
    }

    const target = this.document.layerNodes.getNodeAtPath(path)
    if (!target) {
      console.warn(
        `Paplico.enterLayer: Layer node not found: /${path.join('/')}`,
      )
      return
    }

    const layer = this.document.getVisuallyByUid(target.visuUid)!

    this._activeVisually = {
      visuType: layer.type,
      layerUid: target!.visuUid,
      pathToLayer: path,
    }
    this._activeVisuallyEntity = layer

    console.info(`Enter layer: ${path.join('/')}`)

    if (!__internal_skipEmit) {
      this.emit('activeLayerChanged', { current: this._activeVisually })
    }
  }

  public getPreviewImage(layerUid: string) {
    return this.previews.get(layerUid)
  }

  /** @deprecated */
  public resolveLayer(uid: string) {
    let runtimeEntity = this.visuElements.get(uid)
    if (runtimeEntity) return runtimeEntity

    const layer = this.document.getVisuallyByUid(uid)
    if (!layer) return undefined

    runtimeEntity = {
      lastUpdated: 0,
      source: new WeakRef(layer),
    }

    this.visuElements.set(uid, runtimeEntity)
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
    const layer = this.document.visuElements.find((l) => l.uid === layerUid)
    if (!layer) return false

    const bitmap = this.layerImageCache.get(layerUid)
    if (!bitmap) return false

    if (layer.type === 'vectorObject') {
      return bitmap.width === size.width && bitmap.height === size.height
    }

    return true
  }

  public getLayerBitmapCache(layerUid: string) {
    return this.layerImageCache.get(layerUid)
  }

  public async getOrCreateLayerBitmapCache(
    visUid: string,
    size?: { width: number; height: number },
  ) {
    const vis = this.document.getVisuallyByUid(visUid)
    if (!vis) return null

    const runtimeEntity = this.visuElements.get(visUid) ?? {
      lastUpdated: 0,
      source: new WeakRef(vis),
    }
    this.visuElements.set(visUid, runtimeEntity)

    if (vis?.type !== 'canvas' && !size) {
      throw new Error(
        'Cannot create bitmap cache without size when layer is not CanvasVisually',
      )
    }

    let bitmap = this.layerImageCache.get(visUid)

    // if different size needed in vector layer, dispose current cache
    if (
      vis.type === 'vectorObject' &&
      (bitmap?.width !== size?.width || bitmap?.height !== size?.height)
    ) {
      bitmap?.close()
      bitmap = void 0
    }

    if (bitmap) return bitmap

    if (vis.type === 'canvas') {
      bitmap = await createImageBitmapImpl(
        vis.bitmap
          ? createImageData(vis.bitmap, vis.width, vis.height)
          : createImageData(vis.width, vis.height),
      )

      runtimeEntity.lastUpdated = Date.now()

      this.layerImageCache.set(visUid, bitmap)
      await this.previews.generateAndSet(visUid, bitmap)
    } else if (vis.type === 'vectorObject') {
      bitmap = await createImageBitmapImpl(
        createImageData(size!.width, size!.height),
      )

      runtimeEntity.lastUpdated = Date.now()

      this.visuElements.set(visUid, runtimeEntity)
      this.layerImageCache.set(visUid, bitmap)
      await this.previews.generateAndSet(visUid, bitmap)
    }

    return bitmap
  }

  public invalidateLayerBitmapCache(visuUid: string) {
    this.layerImageCache.delete(visuUid)
  }

  public invalidateAllLayerBitmapCache() {
    this.layerImageCache.forEach((bitmap) => bitmap.close())
    this.layerImageCache.clear()
  }

  public invalidateVectorObjectCache(vectorObject: VectorObject) {
    this.emit('invalidateVectorPathCacheRequested', { object: vectorObject })
  }

  // public getLayerImageBitmap(layerUid: string) {}

  public async updateOrCreateLayerBitmapCache(
    visuallyUid: string,
    newBitmap: ImageData,
  ) {
    const visually = this.document.getVisuallyByUid(visuallyUid)
    const bitmap = this.layerImageCache.get(visuallyUid)
    bitmap?.close()

    if (visually?.type !== 'group') {
      console.warn(
        'Primitive Visually usign bitmap cache it performs bad memory usage',
      )
    }

    if (visually?.type === 'canvas') {
      visually.bitmap = newBitmap.data
    }

    const nextBitmap = await createImageBitmapImpl(newBitmap)
    this.layerImageCache.set(visuallyUid, nextBitmap)
    this.previews.generateAndSet(visuallyUid, nextBitmap)

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
    const layer = this.document.visuElements.find((l) => l.uid === layerUid)
    if (!layer) return

    return this.layerMetrics.get(layer?.uid)
  }
}
