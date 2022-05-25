import { fit, position } from 'object-fit-math'

import { mapSeries } from '../../utils/array'
import { PaplicoEngine } from '../Engine3'
import { createContext2D } from '../../Engine3_CanvasFactory'
import { Document, LayerTypes } from '../../DOM'
import {
  createKeyedRequestIdeCallback,
  setCanvasSize,
  setCanvasSizeIfDifferent,
} from '../../utils'
import { deepClone, pick } from '../../utils/object'
import { IRenderStrategy } from './IRenderStrategy'
import { AtomicResource } from '../../AtomicResource'
import { CompositeMode } from '../../DOM/ILayer'
import { PapDOMDigger } from '../../PapDOMDigger'
import { workerSafeCanvasToBlob } from '../../PapHelpers'
import {
  logGroup,
  logGroupEnd,
  logImage,
  logLog,
  logTime,
  logTimeEnd,
  timeSumming,
} from '../../DebugHelper'
import { saveAndRestoreCanvas } from '../../utils/canvas'

type Override = {
  layerId: string
  context2d: CanvasRenderingContext2D
  compositeMode: CompositeMode | 'destination-out'
}

export class DifferenceRender implements IRenderStrategy {
  // private vectorBitmapCache: WeakMap<LayerTypes, ImageBitmap> = new WeakMap()
  private bitmapCache: WeakMap<LayerTypes, CanvasRenderingContext2D> =
    new WeakMap()
  // private layerLastUpdateTimes = new WeakMap<LayerTypes, number>()
  private needsUpdateLayerIds: { [layerId: string]: true | undefined } = {}
  private overrides: Override | null = null

  private bufferCtx: AtomicResource<CanvasRenderingContext2D>
  private atomicPreviewCtx: AtomicResource<CanvasRenderingContext2D>
  private convertCtx = createContext2D()
  private previews: { [layerId: string]: string } = Object.create(null)

  private keyedRequestIdleCallback = createKeyedRequestIdeCallback()

  constructor() {
    const bufferCtx = createContext2D()
    this.bufferCtx = new AtomicResource(bufferCtx)
    // document.body.appendChild(bufferCtx.canvas)

    const previewCtx = createContext2D()
    setCanvasSize(previewCtx.canvas, 100, 100)
    this.atomicPreviewCtx = new AtomicResource(previewCtx)
    // previewCtx.canvas.id = 'preview-canvas-difference-render'
    // document.body.appendChild(previewCtx.canvas)
  }

  public get renderScale() {
    return 1
  }

  public getPreiewForLayer(uid: string) {
    return this.previews[uid]
  }

  public markUpdatedLayerId(layerId: string) {
    this.needsUpdateLayerIds[layerId] = true
  }

  public setLayerOverride(override: Override | null) {
    this.overrides = override
  }

  public clearCache() {
    this.bitmapCache = new WeakMap()
  }

  public async dispose() {
    const ctx = await this.bufferCtx.enjure()

    // Freeing memory for Safari
    // See: https://stackoverflow.com/questions/52532614/total-canvas-memory-use-exceeds-the-maximum-limit-safari-12
    setCanvasSize(ctx.canvas, 0, 0)
    setCanvasSize((await this.atomicPreviewCtx.enjure()).canvas, 0, 0)

    this.bufferCtx = null!
  }

  public async render(
    engine: PaplicoEngine,
    document: Document,
    destCtx: CanvasRenderingContext2D
  ): Promise<void> {
    const perf_fetch = timeSumming('Fetch layer bitmaps')
    const perf_initCanvas = timeSumming('Init layer buffer canvas')
    const perf_composite = timeSumming('Composite layer')
    const perf_filter = timeSumming('Composite filter')
    const perf_filterLayer = timeSumming('Composite filter layer')

    const layerBufferCtx = await this.bufferCtx.enjure({ owner: this })
    const filterCtx = createContext2D()
    setCanvasSize(layerBufferCtx.canvas, document.width, document.height)
    setCanvasSize(filterCtx.canvas, destCtx.canvas.width, destCtx.canvas.height)

    type LayerBitmapResult = {
      layer: LayerTypes
      needsUpdate: boolean
      image: HTMLCanvasElement | null
      subResults?: Omit<LayerBitmapResult, 'subResults'>[]
    }

    const referencedLayers = new Map()
    PapDOMDigger.traverseLayers(document, { kind: 'reference' }, (layer) => {
      referencedLayers.set(
        layer.uid,
        PapDOMDigger.findLayerRecursive(document, layer.referencedLayerId, {
          strict: false,
        })
      )
    })

    const getLayerBitmap = async (
      layer: LayerTypes,
      requestStack: string[],
      ignoreVisibility: boolean = false
    ): Promise<LayerBitmapResult> => {
      if (!layer.visible && !ignoreVisibility)
        return { layer, needsUpdate: false, image: null }

      if (requestStack.includes(layer.uid)) {
        throw new Error(
          `Circular reference detected: ${requestStack.join(' -> ')}`
        )
      }

      // Needs rerender
      switch (layer.layerType) {
        case 'group': {
          const results: Omit<LayerBitmapResult, 'subResults'>[] = []

          for (const subLayer of layer.layers) {
            const result = await getLayerBitmap(subLayer, [
              ...requestStack,
              layer.uid,
            ])
            results.push(result)
          }

          return {
            layer,
            needsUpdate: results.some((r) => r.needsUpdate),
            image: null,
            subResults: results,
          }
        }
        case 'vector': {
          logGroup(`Render vector layer: ${layer.uid}`)

          const hasCache = !!this.bitmapCache.get(layer)
          const cachedCtx = this.bitmapCache.get(layer) ?? createContext2D()
          this.bitmapCache.set(layer, cachedCtx)

          const layerSize = document.getLayerSize(layer)
          const hasSizeChange =
            layerSize.width !== cachedCtx.canvas.width ||
            layerSize.height !== cachedCtx.canvas.height
          if (hasSizeChange) {
            setCanvasSize(cachedCtx.canvas, layerSize)
          }

          logLog(layer, {
            rerender: !!(
              !hasCache ||
              hasSizeChange ||
              this.needsUpdateLayerIds[layer.uid]
            ),
          })

          if (
            !hasCache ||
            hasSizeChange ||
            this.needsUpdateLayerIds[layer.uid]
          ) {
            cachedCtx.clearRect(0, 0, document.width, document.height)
            await engine.renderVectorLayer(document, layer, cachedCtx)
          }

          this.keyedRequestIdleCallback(layer.uid, () => {
            this.setPreviewForLayer(layer, document, cachedCtx.canvas)
          })

          logTimeEnd(`Render vector layer: ${layer.uid}`)
          logGroupEnd()

          return {
            layer,
            needsUpdate: !!this.needsUpdateLayerIds[layer.uid],
            image: cachedCtx.canvas,
          }
        }
        case 'raster': {
          // const image = await layer.imageBitmap

          const hasCache = !!this.bitmapCache.get(layer)
          const cachedCtx = this.bitmapCache.get(layer) ?? createContext2D()
          this.bitmapCache.set(layer, cachedCtx)

          const layerSize = document.getLayerSize(layer)
          const hasSizeChange =
            layerSize.width !== cachedCtx.canvas.width ||
            layerSize.height !== cachedCtx.canvas.height
          if (hasSizeChange) {
            setCanvasSize(cachedCtx.canvas, layerSize)
          }

          if (
            !hasCache ||
            hasSizeChange ||
            this.needsUpdateLayerIds[layer.uid]
          ) {
            logTime('putImageData')
            cachedCtx.putImageData(
              new ImageData(layer.bitmap, layer.width, layer.height),
              0,
              0
            )
            logTimeEnd('putImageData')
          }

          this.keyedRequestIdleCallback(layer.uid, () => {
            this.setPreviewForLayer(layer, document, cachedCtx.canvas)
          })

          return {
            layer,
            needsUpdate: !!this.needsUpdateLayerIds[layer.uid],
            image: cachedCtx.canvas,
          }
        }
        case 'filter': {
          return { layer, needsUpdate: false, image: null }
        }
        case 'text': {
          return { layer, needsUpdate: false, image: null }
        }
        case 'reference': {
          if (layer.uid === layer.referencedLayerId)
            return { layer, needsUpdate: false, image: null }

          const referenced = referencedLayers.get(layer.uid)
          const result = referenced
            ? await getLayerBitmap(
                referenced,
                [...requestStack, layer.uid],
                true
              )
            : null
          return result
            ? { layer, needsUpdate: result.needsUpdate, image: result.image }
            : { layer, needsUpdate: false, image: null }
        }
      }
    }

    const createLayerBitmapRequestHandler = (requesterLayerUid: string) => {
      return async (layerUid: string) => {
        const perf_requesLayerBitmap = timeSumming('requestLayerBitmap', '🫂')
        perf_requesLayerBitmap.time()

        try {
          const layer = PapDOMDigger.findLayerRecursive(document, layerUid)

          if (!layer) return { missing: true } as const

          return {
            missing: false,
            image: (await getLayerBitmap(layer, [requesterLayerUid], true))
              .image!,
          } as const
        } finally {
          perf_requesLayerBitmap.timeEnd()
          perf_requesLayerBitmap.log()
        }
      }
    }

    logTime('Render or fetch all layer bitmaps')
    const layerBitmaps = await mapSeries(
      [...document.layers].reverse(),
      async (layer) => {
        perf_fetch.time()
        const result = await getLayerBitmap(layer, [])
        perf_fetch.timeEnd()

        return result
      }
    )
    logTimeEnd('Render or fetch all layer bitmaps')

    const compositeTo = async (
      { layer, image, subResults }: LayerBitmapResult,
      dest: CanvasRenderingContext2D
    ) => {
      if (!layer.visible) return

      perf_initCanvas.time()

      const prev = pick(layerBufferCtx.canvas, ['width', 'height'])

      setCanvasSizeIfDifferent(layerBufferCtx.canvas, document)
      layerBufferCtx.clearRect(0, 0, document.width, document.height)

      const mixBufferCtx = createContext2D()
      setCanvasSizeIfDifferent(mixBufferCtx.canvas, document)

      perf_initCanvas.timeEnd(
        prev,
        pick(layerBufferCtx.canvas, ['width', 'height'])
      )

      // Apply FilterLayer
      perf_filterLayer.time()

      if (image == null && layer.layerType === 'filter') {
        // TODO
        // if (disableAllFilters) continue

        setCanvasSizeIfDifferent(filterCtx.canvas, document)
        layerBufferCtx.drawImage(destCtx.canvas, 0, 0)

        for (const filter of [...layer.filters].reverse()) {
          if (!filter.visible) continue

          const instance = engine.toolRegistry.getFilterInstance(
            filter.filterId
          )

          if (!instance)
            throw new Error(`Filter not found (id:${filter.filterId})`)

          await saveAndRestoreCanvas(filterCtx, async () => {
            filterCtx.clearRect(0, 0, document.width, document.height)

            await engine.applyFilter(layerBufferCtx, filterCtx, instance, {
              layer: layer,
              size: { width: document.width, height: document.height },
              filterSettings: deepClone(filter.settings),
              opacity: filter.opacity,
              handleLayerBitmapRequest: createLayerBitmapRequestHandler(
                layer.uid
              ),
            })
          })

          layerBufferCtx.clearRect(0, 0, document.width, document.height)
          layerBufferCtx.drawImage(filterCtx.canvas, 0, 0)
        }

        // destCtx.clearRect(0, 0, document.width, document.height)
        // destCtx.drawImage(layerBufferCtx.canvas, 0, 0)

        await engine.compositeLayers(layerBufferCtx, destCtx, {
          mode: layer.compositeMode,
          opacity: layer.opacity,
          sourceOption: { opacity: 1 - layer.opacity },
        })

        return
      }
      perf_filterLayer.timeEnd(layer.filters.length, layer.filters)

      if (image == null && layer.layerType === 'group' && subResults) {
        // When isolated group, contained layers are render to new buffer and
        // composite new buffer to destination
        if (!layer.compositeIsolation) {
          const groupCtx = createContext2D()
          setCanvasSize(groupCtx.canvas, document.getLayerSize(layer))

          for (const r of subResults) {
            await compositeTo(r, groupCtx)
          }

          await engine.compositeLayers(groupCtx, destCtx, {
            mode: layer.compositeMode,
            opacity: layer.opacity,
          })

          setCanvasSize(groupCtx.canvas, 0, 0)
        } else {
          // When non-isolated group, contained layers are composited each to destination directly

          for (const r of subResults) {
            await compositeTo(r, dest)
          }

          return
        }
      }

      if (image == null) return

      layerBufferCtx.drawImage(image, layer.x, layer.y)

      if (this.overrides?.layerId === layer.uid) {
        await engine.compositeLayers(this.overrides.context2d, layerBufferCtx, {
          mode: this.overrides.compositeMode,
          opacity: layer.opacity,
          position: { x: layer.x, y: layer.y },
        })
      }

      if (hasVisibleFilter(layer)) {
        filterCtx.clearRect(0, 0, document.width, document.height)
        filterCtx.drawImage(layerBufferCtx.canvas, 0, 0)
      }

      perf_composite.time()

      for (const filter of [...layer.filters].reverse()) {
        if (!filter.visible) continue
        // if (disableAllFilters) continue

        const instance = engine.toolRegistry.getFilterInstance(filter.filterId)!
        if (!instance)
          throw new Error(`Filter not found (id:${filter.filterId})`)

        if (
          filterCtx.canvas.width !== document.width ||
          filterCtx.canvas.height !== document.height
        ) {
          setCanvasSize(filterCtx.canvas, document)
        }

        await saveAndRestoreCanvas(filterCtx, async () => {
          filterCtx.clearRect(0, 0, document.width, document.height)

          await engine.applyFilter(layerBufferCtx, filterCtx, instance, {
            layer,
            size: { width: document.width, height: document.height },
            opacity: filter.opacity,
            filterSettings: deepClone(filter.settings),
            handleLayerBitmapRequest: createLayerBitmapRequestHandler(
              layer.uid
            ),
          })
        })

        layerBufferCtx.clearRect(0, 0, document.width, document.height)
        layerBufferCtx.drawImage(mixBufferCtx.canvas, 0, 0)
      }

      perf_filter.timeEnd()
      perf_composite.time()

      await engine.compositeLayers(layerBufferCtx, dest, {
        mode: layer.compositeMode,
        opacity: layer.opacity,
      })

      perf_composite.timeEnd(layer, document.getLayerSize(layer))
    }

    // Composite layers
    try {
      for (const result of layerBitmaps) {
        await compositeTo(result, destCtx)
      }

      this.needsUpdateLayerIds = {}
    } catch (e) {
      throw e
    } finally {
      perf_fetch.log()
      perf_initCanvas.log()
      perf_filter.log()
      perf_filterLayer.log()
      perf_composite.log()

      this.bufferCtx.release(layerBufferCtx)
    }
  }

  private async setPreviewForLayer(
    layer: LayerTypes,
    document: Document,
    bitmap: CanvasImageSource
  ) {
    return
    const ctx = await this.atomicPreviewCtx.enjure({ owner: this })
    const c = ctx.canvas

    try {
      const layerSize = document.getLayerSize(layer)
      setCanvasSize(this.convertCtx.canvas, document.getLayerSize(layer))
      this.convertCtx.drawImage(bitmap, 0, 0)

      const pos = position(c, layerSize, 'center', 'center')
      const size = fit(c, layerSize, 'contain')

      ctx.clearRect(0, 0, c.width, c.height)
      ctx.drawImage(
        this.convertCtx.canvas,
        pos.x,
        pos.y,
        size.width,
        size.height
      )

      const blob = await workerSafeCanvasToBlob(c, { type: 'image/png' })

      if (this.previews[layer.uid])
        URL.revokeObjectURL(this.previews[layer.uid])
      this.previews[layer.uid] = URL.createObjectURL(blob)
    } finally {
      this.atomicPreviewCtx.release(ctx)
      setCanvasSize(this.convertCtx.canvas, 0, 0)
    }

    // const bufferCtx = await this.bufferCtx.enjure({ owner: this })
    // setCanvasSize(bufferCtx.canvas, 100, 100)
    // try {
    //   for (const entry of layerBitmaps) {
    //     if (
    //       entry.layer.layerType !== 'raster' &&
    //       entry.layer.layerType !== 'vector'
    //     )
    //       return
    //     if (!entry.image) return
    //     if (entry.needsUpdate === false) return
    //     const { width, height } = document.getLayerSize(entry.layer)
    //     setCanvasSize(this.previewCtx.canvas, width, height)
    //     this.previewCtx.clearRect(0, 0, width, height)
    //     bufferCtx.clearRect(
    //       0,
    //       0,
    //       bufferCtx.canvas.width,
    //       bufferCtx.canvas.height
    //     )
    //     this.previewCtx.putImageData(entry.image, 0, 0)
    //     bufferCtx.drawImage(this.previewCtx.canvas, 0, 0, 100, 100)
    //     const blob = await new Promise<Blob | null>((r) =>
    //       bufferCtx.canvas.toBlob(r, 'image/png')
    //     )
    //     if (this.previews[entry.layer.uid])
    //       URL.revokeObjectURL(this.previews[entry.layer.uid])
    //     this.previews[entry.layer.uid] = URL.createObjectURL(blob!)
    //   }
    // } finally {
    //   this.bufferCtx.release(bufferCtx)
    // }
  }
}

const hasVisibleFilter = (layer: LayerTypes) => {
  if (layer.filters.length === 0) return false
  return layer.filters.some((filter) => filter.visible)
}
