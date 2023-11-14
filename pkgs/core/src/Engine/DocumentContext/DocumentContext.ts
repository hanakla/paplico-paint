import { PaplicoDocument } from '@/Document/PaplicoDocument'
import { AtomicResource } from '@/utils/AtomicResource'
import { History } from '@/Engine/History/History'
import { ICommand } from '@/Engine/History/ICommand'
import { PreviewStore } from '@/Engine/DocumentContext/PreviewStore'
import { Emitter } from '@paplico/shared-lib'
import { LayerMetrics } from './LayerMetrics'
import { VisuElement } from '@/Document'
import {
  createImageBitmapImpl,
  createImageData,
} from '../../Infra/CanvasFactory'
import {
  PPLCOptionInvariantViolationError,
  PPLCInvariantViolationError,
} from '@/Errors'
import { rescue, throwLaterIfFailure } from '@/utils/rescue'

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

  export type StrokingTarget = {
    visuType:
      | VisuElement.GroupElement['type']
      | VisuElement.CanvasElement['type']
    visuUid: string
    nodePath: string[]
    visu: VisuElement.GroupElement | VisuElement.CanvasElement
  }

  export type Events = {
    invalidateVectorPathCacheRequested: {
      object: VisuElement.VectorObjectElement
    }
    strokingTargetChanged: {
      current: StrokingTarget | null
    }
    'preview:updated': PreviewStore.Events['updated']
  }
}

export class DocumentContext extends Emitter<DocumentContext.Events> {
  public document: PaplicoDocument
  public history: History

  public layerNodeBitmapCache: Map<string, ImageBitmap> = new Map()
  public blobCaches: Map<string, WeakRef<any>> = new Map()

  public layerMetrics = new LayerMetrics(this)
  protected visuElements = new Map<string, DocumentContext.VisuallyPointer>()
  public previews: PreviewStore

  public updaterLock = new AtomicResource({}, 'RuntimeDocument#updateLock')

  protected _strokingTarget: DocumentContext.StrokingTarget | null = null

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
    this._strokingTarget = null

    this.mitt.all.clear()
    this.updaterLock.clearQueue()

    this.previews.dispose()
    this.history.dispose()
    this.layerMetrics.dispose()
    this.layerNodeBitmapCache.forEach((bitmap) => bitmap.close())
    this.layerNodeBitmapCache.clear()
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

  public get strokingTarget() {
    return this._strokingTarget
  }

  public setStrokingTarget(path: string[] | null | undefined): boolean {
    if (!path) {
      this._strokingTarget = null
      this.emit('strokingTargetChanged', { current: null })
      return true
    }

    const doc = this.document

    const targetNode = doc.layerNodes.getNodeAtPath(path)
    if (!targetNode) {
      return false
    }

    const visu = doc.getVisuByUid(targetNode.visuUid)!
    if (!doc.isDrawableVisu(visu)) {
      return false
    }

    this._strokingTarget = {
      visuType: visu.type,
      visuUid: targetNode!.visuUid,
      nodePath: path,
      visu,
    }

    throwLaterIfFailure([
      rescue(() =>
        this.emit('strokingTargetChanged', { current: this._strokingTarget }),
      ),
    ])

    return true
  }

  public getPreviewImage(layerUid: string) {
    return this.previews.get(layerUid)
  }

  /** @deprecated */
  public resolveLayer(uid: string) {
    let runtimeEntity = this.visuElements.get(uid)
    if (runtimeEntity) return runtimeEntity

    const layer = this.document.getVisuByUid(uid)
    if (!layer) return undefined

    runtimeEntity = {
      lastUpdated: 0,
      source: new WeakRef(layer),
    }

    this.visuElements.set(uid, runtimeEntity)
    return runtimeEntity
  }

  public resolveVisuByUid(uid: string) {
    return this.document.getVisuByUid(uid)
  }

  /** Check valid bitmap cache in requested size availablity */
  public hasLayerNodeBitmapCache(
    visuNodeUid: string,
    size: { width: number; height: number },
  ) {
    const bitmap = this.layerNodeBitmapCache.get(visuNodeUid)
    if (!bitmap) return false

    return bitmap.width === size.width && bitmap.height === size.height
  }

  public getLayerNodeBitmapCache(layerUid: string) {
    return this.layerNodeBitmapCache.get(layerUid)
  }

  public async getOrCreateLayerNodeBitmapCache(
    visUid: string,
    size?: { width: number; height: number },
  ) {
    const visu = this.document.getVisuByUid(visUid)
    if (!visu) return null

    // Don't cache orphaned and vector Visu
    if (visu.type !== 'group' && visu.type !== 'canvas') {
      return null
    }

    const runtimeEntity = this.visuElements.get(visUid) ?? {
      lastUpdated: 0,
      source: new WeakRef(visu),
    }
    this.visuElements.set(visUid, runtimeEntity)

    if (visu?.type !== 'canvas' && !size) {
      throw new Error(
        'Cannot create bitmap cache without size when layer is not CanvasVisually',
      )
    }

    let bitmap = this.layerNodeBitmapCache.get(visUid)

    // if different size needed in vector layer, dispose current cache
    if (
      visu.type === 'group' &&
      (bitmap?.width !== size?.width || bitmap?.height !== size?.height)
    ) {
      bitmap?.close()
      bitmap = void 0
    }

    if (bitmap) return bitmap

    if (visu.type === 'canvas') {
      bitmap = await createImageBitmapImpl(
        visu.bitmap
          ? createImageData(
              visu.bitmap as unknown as Uint8ClampedArray,
              visu.width,
              visu.height,
            )
          : createImageData(visu.width, visu.height),
      )

      runtimeEntity.lastUpdated = Date.now()

      this.layerNodeBitmapCache.set(visUid, bitmap)
      await this.previews.generateAndSet(visUid, bitmap)
    } else if (visu.type === 'group') {
      bitmap = await createImageBitmapImpl(
        createImageData(size!.width, size!.height),
      )

      runtimeEntity.lastUpdated = Date.now()

      this.visuElements.set(visUid, runtimeEntity)
      this.layerNodeBitmapCache.set(visUid, bitmap)
      await this.previews.generateAndSet(visUid, bitmap)
    }

    return bitmap
  }

  public invalidateLayerBitmapCache(visuUid: string | string[]) {
    visuUid = Array.isArray(visuUid) ? visuUid : [visuUid]
    visuUid.forEach((uid) => {
      this.layerNodeBitmapCache.get(uid)?.close()
      this.layerNodeBitmapCache.delete(uid)
    })
  }

  public invalidateAllLayerBitmapCache() {
    this.layerNodeBitmapCache.forEach((bitmap) => bitmap.close())
    this.layerNodeBitmapCache.clear()
  }

  public invalidateVectorObjectCache(
    vectorObject: VisuElement.VectorObjectElement,
  ) {
    this.emit('invalidateVectorPathCacheRequested', { object: vectorObject })
  }

  // public getLayerImageBitmap(layerUid: string) {}

  public async updateOrCreateLayerBitmapCache(
    visuUid: string,
    newBitmap: ImageData,
  ) {
    const visu = this.document.getVisuByUid(visuUid)
    if (!visu) {
      throw new PPLCInvariantViolationError(
        `Visu not found in updateOrCreateLayerBitmapCache: ${visuUid}`,
      )
    }

    if (visu.type !== 'group' && visu.type !== 'canvas') {
      return
    }

    const bitmap = this.layerNodeBitmapCache.get(visuUid)
    bitmap?.close()

    if (visu?.type === 'canvas') {
      visu.bitmap = newBitmap.data
    }

    const nextBitmap = await createImageBitmapImpl(newBitmap)
    this.layerNodeBitmapCache.set(visuUid, nextBitmap)
    this.previews.generateAndSet(visuUid, nextBitmap)

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

  public updateVisuMetrices(metrices: Record<string, LayerMetrics.BBoxSet>) {
    this.layerMetrics.setVisuMetrices(metrices)
  }

  public getLayerMetrics(layerUid: string) {
    const layer = this.document.visuElements.find((l) => l.uid === layerUid)
    if (!layer) return

    return this.layerMetrics.getLayerMetrics(layer?.uid)
  }
}
