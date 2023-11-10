import { PPLCAbortError, PPLCInvariantViolationError } from '@/Errors'
import { AtomicResource } from '@/utils/AtomicResource'
import { saveAndRestoreCanvas } from '@/utils/canvas'
import { deepClone } from '@paplico/shared-lib'
import { OrthographicCamera, WebGLRenderer } from 'three'
import { BrushRegistry } from './Registry/BrushRegistry'
import { InkRegistry } from './Registry/InkRegistry'
import { RenderCycleLogger } from './RenderCycleLogger'
import { RenderPhase, Viewport } from './types'
import {
  addPoint2D,
  calcVectorBoundingBox,
  calcVectorPathBoundingBox,
  composeVisuTransformsToDOMMatrix,
  multiplyPoint2D,
} from './VectorUtils'
import { AppearanceRegistry } from './Registry/AppearanceRegistry'
import { FontRegistry } from './Registry/FontRegistry'
import { BrushLayoutData, IBrush } from './Brush/Brush'
import {
  LayerMetrics,
  createBBox,
  createEmptyBBox,
} from './DocumentContext/LayerMetrics'
import { PaplicoRenderWarnAbst } from '@/Errors/Warns/PaplicoRenderWarnAbst'
import { reduceAsync } from '@/utils/array'
import { MissingFilterWarn } from '@/Errors/Warns/MissingFilterWarn'
import { VisuElement, VisuFilter } from '@/Document'
import {
  DEFAULT_VISU_TRANSFORM,
  createVectorObjectVisually,
} from '@/Document/Visually/factory'
import { LogChannel } from '@/Debugging/LogChannel'
import { svgPathToVisuVectorPath } from '@/SVGPathManipul/pathStructConverters'
import { DocumentContext } from './DocumentContext/DocumentContext'
import { shallowEquals } from '@paplico/shared-lib'

type StrokeMemoEntry<T> = {
  data: T
  prevDeps: any[]
}

export namespace VectorRenderer {
  export type VisuTransformOverrides = {
    [visuUid: string]: {
      <T extends VisuElement.AnyElement>(base: T): T
    }
  }
}

export class VectorRenderer {
  protected brushRegistry: BrushRegistry
  protected inkRegistry: InkRegistry
  protected filterRegistry: AppearanceRegistry
  protected fontRegistry: FontRegistry

  protected glRendererResource: AtomicResource<WebGLRenderer>

  protected camera: OrthographicCamera
  protected strokeMemo: WeakMap<
    VisuElement.VectorPath,
    WeakMap<IBrush, StrokeMemoEntry<any>>
  > = new WeakMap()

  protected fillRenderLock = new AtomicResource({})
  protected strokeRenderLock = new AtomicResource({})

  constructor(options: {
    brushRegistry: BrushRegistry
    inkRegistry: InkRegistry
    appearanceRegistry: AppearanceRegistry
    fontRegistry: FontRegistry
    glRenderer: AtomicResource<WebGLRenderer>
  }) {
    this.brushRegistry = options.brushRegistry
    this.inkRegistry = options.inkRegistry
    this.filterRegistry = options.appearanceRegistry
    this.fontRegistry = options.fontRegistry

    this.glRendererResource = options.glRenderer
    this.camera = new OrthographicCamera(0, 0, 0, 0, 0, 1000)
  }

  public dispose() {
    this.glRendererResource.ensureForce().dispose()
  }

  public async invalidateStrokeMemo(path: VisuElement.VectorPath) {
    this.strokeMemo.delete(path)
  }

  public async renderCanvasVisu(
    visu: VisuElement.CanvasElement,
    output: CanvasRenderingContext2D,
    docx: DocumentContext,
    {
      viewport,
      pixelRatio,
      abort,
      logger,
      phase,
      transformOverrides,
      parentTransform = DEFAULT_VISU_TRANSFORM(),
    }: {
      viewport: Viewport
      pixelRatio: number
      abort?: AbortSignal
      logger?: RenderCycleLogger
      phase: RenderPhase
      transformOverrides?: VectorRenderer.VisuTransformOverrides
      parentTransform?: VisuElement.ElementTransform
    },
  ) {
    const bitmap = await docx.getOrCreateLayerNodeBitmapCache(visu.uid)
    if (!bitmap) {
      throw new PPLCInvariantViolationError("Canvas visu's  bitmap not found.")
    }

    visu = transformOverrides?.[visu.uid]?.(deepClone(visu)) ?? visu

    const matrix = composeVisuTransformsToDOMMatrix(
      parentTransform,
      visu.transform,
    )

    await saveAndRestoreCanvas(output, async () => {
      output.setTransform(matrix)

      output.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height)
    })

    const originalBBox: LayerMetrics.BBox = createBBox({
      left: matrix.transformPoint([0, 0]).x,
      top: matrix.transformPoint([0, 0]).y,
      width: matrix.transformPoint([bitmap.width, 0]).x,
      height: matrix.transformPoint([0, bitmap.height]).y,
    })

    return {
      original: createBBox(originalBBox),
      postFilter: createBBox(originalBBox),
    }
  }

  public async renderVectorVisu(
    visu: VisuElement.TextElement | VisuElement.VectorObjectElement,
    output: CanvasRenderingContext2D,
    {
      viewport,
      pixelRatio,
      abort,
      logger,
      phase,
      transformOverrides,
      parentTransform = DEFAULT_VISU_TRANSFORM(),
    }: {
      viewport: Viewport
      pixelRatio: number
      abort?: AbortSignal
      logger?: RenderCycleLogger
      phase: RenderPhase
      transformOverrides?: VectorRenderer.VisuTransformOverrides
      parentTransform?: VisuElement.ElementTransform
    },
  ): Promise<LayerMetrics.BBoxSet> {
    // if (visu.type === 'group') {
    //   throw new PPLCInvalidOptionOrStateError(
    //     'Group node is can not be rendering in VectorRenderer, ' +
    //       'use RenderPipeline.renderNode instead',
    //   )
    // }

    const objectsBBox: Record<string, LayerMetrics.BBoxSet> = {}
    let objects: VisuElement.VectorObjectElement[] = []

    if (visu.type === 'text') {
      LogChannel.l.vectorRenderer.info('Text node found', visu)
      objects = await this.generateTextVectorObject(visu)
    } else if (visu.type === 'vectorObject') {
      objects = [visu]
    }

    for (let obj of objects) {
      if (!obj.visible) continue

      const sourceBBox = calcVectorBoundingBox(obj) // Ignore override for source
      let postFilterBBox = sourceBBox

      if (transformOverrides?.[visu.uid]) {
        obj = transformOverrides?.[visu.uid]!(deepClone(obj))
      }

      await saveAndRestoreCanvas(output, async () => {
        // if (obj.type === 'vectorGroup') return { objectsBBox } // for typecheck

        for (const ap of obj.filters) {
          if (ap.kind === 'fill') {
            await this.renderFill(obj.path, output, ap.fill, {
              pixelRatio: pixelRatio,
              transform: {
                position: addPoint2D(
                  parentTransform.position,
                  obj.transform.position,
                ),
                scale: multiplyPoint2D(
                  parentTransform.scale,
                  obj.transform.scale,
                ),
                rotate: parentTransform.rotate + obj.transform.rotate,
              },
              phase,
              abort,
              logger,
            })
          } else if (ap.kind === 'stroke') {
            const brush = this.brushRegistry.getInstance(ap.stroke.brushId)

            if (brush == null) {
              throw new Error(`Unregistered brush ${ap.stroke.brushId}`)
            }

            const { bbox } = await this.renderStroke(
              obj.path,
              output,
              ap.stroke,
              {
                abort: abort,
                inkSetting: ap.ink,
                pixelRatio,
                transform: {
                  position: addPoint2D(
                    parentTransform.position,
                    obj.transform.position,
                  ),
                  scale: multiplyPoint2D(
                    parentTransform.scale,
                    obj.transform.scale,
                  ),
                  rotate: parentTransform.rotate + obj.transform.rotate,
                },
                phase: phase,
                logger: logger,
              },
            )

            postFilterBBox = {
              ...bbox,
              width: bbox.right - bbox.left,
              height: bbox.bottom - bbox.top,
              centerX: bbox.left + (bbox.right - bbox.left) / 2,
              centerY: bbox.top + (bbox.bottom - bbox.top) / 2,
            }
          } else if (ap.kind === 'postprocess') {
            continue
          }
        }
      })

      objectsBBox[obj.uid] = {
        original: sourceBBox,
        postFilter: postFilterBBox,
      }
    }

    let originalBBox: LayerMetrics.BBox = createEmptyBBox()
    let postFilterBBox: LayerMetrics.BBox = createEmptyBBox()

    for (const obj of objects) {
      const { original: source, postFilter } = objectsBBox[obj.uid]

      originalBBox.left = Math.min(originalBBox.left, source.left)
      originalBBox.top = Math.min(originalBBox.top, source.top)
      originalBBox.width = Math.max(originalBBox.width, source.width)
      originalBBox.height = Math.max(originalBBox.height, source.height)

      postFilterBBox.left = Math.min(postFilterBBox.left, postFilter.left)
      postFilterBBox.top = Math.min(postFilterBBox.top, postFilter.top)
      postFilterBBox.width = Math.max(postFilterBBox.width, postFilter.width)
      postFilterBBox.height = Math.max(postFilterBBox.height, postFilter.height)
    }

    return {
      original: createBBox(originalBBox),
      postFilter: createBBox(postFilterBBox),
    }
  }

  // protected async renderPath() {}

  public async generateTextVectorObject(layer: VisuElement.TextElement) {
    if (!layer.visible) return []

    const objects: VisuElement.VectorObjectElement[] = []

    let curX = layer.transform.position.x
    let curY = layer.transform.position.y
    let curBaseline = 0

    // #region Linebreak nomarlize
    const lineBreakedNodes: VisuElement.TextNode[][] = []
    let currentLine: VisuElement.TextNode[] = []
    let currentNode: VisuElement.TextNode

    for (
      let nodeIdx = 0, nodeLen = layer.textNodes.length;
      nodeIdx < nodeLen;
      nodeIdx++
    ) {
      let node = layer.textNodes[nodeIdx]
      currentNode = {
        fontSize: layer.fontSize,
        fontFamily: layer.fontFamily,
        fontStyle: layer.fontStyle,
        ...node,
        text: '',
      }

      for (
        let charIdx = 0, chars = [...node.text], charLen = chars.length;
        charIdx < charLen;
        charIdx++
      ) {
        if (chars[charIdx] === '\n') {
          currentLine.push(currentNode)
          lineBreakedNodes.push(currentLine)
          currentLine = []
          currentNode = {
            fontSize: layer.fontSize,
            fontFamily: layer.fontFamily,
            fontStyle: layer.fontStyle,
            ...node,
            text: '',
          }
          continue
        } else {
          currentNode.text += chars[charIdx]
        }
      }

      currentLine.push(currentNode)
    }

    lineBreakedNodes.push(currentLine)
    // #endregion

    LogChannel.l.vectorRenderer('generateTextVectorObject: ', lineBreakedNodes)

    for (const lineNodes of lineBreakedNodes) {
      const loadFont = (node: VisuElement.TextNode) => {
        return this.fontRegistry.getFont(
          node.fontFamily ?? layer.fontFamily,
          node.fontStyle ?? layer.fontStyle,
          { fallback: { family: 'Hiragino Sans' } },
        )
      }

      let maxLineHeightPx = 0

      for (const node of lineNodes) {
        const font = await loadFont(node)

        if (!font) {
          LogChannel.l.vectorRenderer.warn(
            `Font not found: ${node.fontFamily ?? layer.fontFamily} ${
              node.fontStyle ?? layer.fontStyle
            }`,
          )
          continue
        }

        const nodeGlyphs = font.stringToGlyphs(node.text)

        for (const glyph of nodeGlyphs) {
          const fontSize = node.fontSize ?? layer.fontSize
          const unitToPxScale = (1 / font.unitsPerEm) * fontSize
          const glyphHeight = glyph.yMax! - glyph.yMin!

          maxLineHeightPx = Math.max(
            maxLineHeightPx,
            glyphHeight * unitToPxScale,
          )
        }
      }

      for (const node of lineNodes) {
        const font = await loadFont(node)
        if (!font) continue

        const nodeGlyphs = font.stringToGlyphs(node.text)

        for (let glyph of nodeGlyphs) {
          const fontSize = node.fontSize ?? layer.fontSize
          const unitToPxScale = (1 / font.unitsPerEm) * fontSize
          const glyphHeightPx = glyph.yMax! - glyph.yMin! * unitToPxScale

          LogChannel.l.vectorRenderer(
            'generateTextVectorObject: Glyph metrics',
            { maxLineHeightPx, glyphHeightPx, unitToPxScale },
          )

          const path = glyph.getPath(curX, curY + maxLineHeightPx, fontSize)

          curX += glyph.advanceWidth! * unitToPxScale

          const metrics = glyph.getMetrics()
          const charPath = svgPathToVisuVectorPath(path.toPathData(5))

          objects.push(
            createVectorObjectVisually({
              opacity: 1,
              blendMode: 'normal',
              path: charPath,
              transform: {
                position: {
                  x: node.position.x,
                  y: node.position.y,
                },
                scale: {
                  x: 1,
                  y: 1,
                },
                rotate: 0,
              },
              filters: [
                {
                  uid: '__TEXT__',
                  enabled: true,
                  kind: 'fill',
                  fill: {
                    type: 'fill',
                    color: { r: 0, g: 0, b: 0 },
                    opacity: 1,
                  },
                },
              ],
            }),
          )
        }
      }
    }

    return objects
  }

  public async renderFill(
    path: VisuElement.VectorPath,
    outcx: CanvasRenderingContext2D,
    fillSetting: VisuFilter.Structs.FillSetting,
    {
      transform,
      pixelRatio,
      abort,
      phase = 'final',
      logger,
      compositionMode = 'normal',
      filtersForPathTransform = [],
    }: {
      transform: VisuElement.ElementTransform
      pixelRatio: number
      abort?: AbortSignal
      phase: RenderPhase
      logger?: RenderCycleLogger
      compositionMode?: VisuElement.StrokeCompositeMode
      filtersForPathTransform?: VisuFilter.PostProcessFilter[]
    },
  ): Promise<{
    warns: PaplicoRenderWarnAbst[]
  }> {
    let warns: PaplicoRenderWarnAbst[] = []

    const fillRenderLock = await this.fillRenderLock.ensure()

    try {
      const transformedPath = await reduceAsync(
        filtersForPathTransform,
        async (path, filter) => {
          if (filter.kind !== 'postprocess') return path

          const processor = this.filterRegistry.getInstance(
            filter.processor.filterId,
          )

          if (!processor) {
            warns.push(
              new MissingFilterWarn(
                filter.processor.filterId,
                'VectorRender.renderFill#transformedPath',
              ),
            )
            return path
          }

          if (!processor.transformPath) return path

          return await processor.transformPath?.(deepClone(path))
        },
        path,
      )

      saveAndRestoreCanvas(outcx, (cx) => {
        cx.globalCompositeOperation = 'source-over'

        cx.beginPath()

        transformedPath.points.forEach((pt, idx, points) => {
          const prev = points[idx - 1]

          if (pt.isMoveTo) {
            cx.moveTo(pt.x * pixelRatio, pt.y * pixelRatio)
          } else if (pt.isClose) {
            cx.closePath()
          } else {
            if (!prev) {
              throw new Error('Unexpected point, previous point is null')
            }

            cx.bezierCurveTo(
              (pt.begin?.x ?? prev!.x) * pixelRatio,
              (pt.begin?.y ?? prev!.y) * pixelRatio,
              (pt.end?.x ?? pt.x) * pixelRatio,
              (pt.end?.y ?? pt.y) * pixelRatio,
              pt.x * pixelRatio,
              pt.y * pixelRatio,
            )
          }
        })

        switch (fillSetting.type) {
          case 'fill': {
            const {
              color: { r, g, b },
              opacity,
            } = fillSetting

            cx.globalAlpha = 1
            cx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${
              b * 255
            }, ${opacity})`
            cx.fill()
            break
          }
          case 'linear-gradient': {
            const { colorStops: colorPoints, opacity, start, end } = fillSetting
            const { width, height, left, top } = calcVectorPathBoundingBox(path)

            // const width = right - left
            // const height = bottom - top
            const centerX = (left + width / 2) * pixelRatio
            const centerY = (top + height / 2) * pixelRatio

            const gradient = cx.createLinearGradient(
              (centerX + start.x) * pixelRatio,
              (centerY + start.y) * pixelRatio,
              (centerX + end.x) * pixelRatio,
              (centerY + end.y) * pixelRatio,
            )

            for (const {
              position,
              color: { r, g, b, a },
            } of colorPoints) {
              gradient.addColorStop(
                position,
                `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${a}`,
              )
            }

            cx.globalAlpha = opacity
            cx.fillStyle = gradient
            cx.fill()
            break
          }
        }
      })
    } finally {
      this.fillRenderLock.release(fillRenderLock)
    }

    return { warns }
  }

  public async renderStroke(
    path: VisuElement.VectorPath,
    output: CanvasRenderingContext2D,
    brushSetting: VisuFilter.Structs.BrushSetting,
    {
      inkSetting,
      transform,
      pixelRatio,
      abort,
      phase,
      logger,
    }: {
      inkSetting: VisuFilter.Structs.InkSetting
      transform: VisuElement.ElementTransform
      pixelRatio: number
      abort?: AbortSignal
      phase: RenderPhase
      logger?: RenderCycleLogger
    },
  ): Promise<BrushLayoutData> {
    const brush = this.brushRegistry.getInstance(brushSetting.brushId)
    const ink = this.inkRegistry.getInstance(inkSetting.inkId)

    if (!brush) throw new Error(`Unregistered brush ${brushSetting.brushId}`)
    if (!ink) throw new Error(`Unregistered ink ${inkSetting.inkId}`)

    const strokeRenderLock = await this.strokeRenderLock.ensure()
    const renderer = await this.glRendererResource.ensure()
    const width = output.canvas.width * pixelRatio
    const height = output.canvas.height * pixelRatio

    renderer.setSize(width, height, false)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()

    this.camera.left = -width / 2.0
    this.camera.right = width / 2.0
    this.camera.top = height / 2.0
    this.camera.bottom = -height / 2.0
    this.camera.updateProjectionMatrix()

    const useMemoForPath = async <T>(
      path: VisuElement.VectorPath,
      factory: () => T,
      deps: any[],
      { disposer }: { disposer?: (obj: T) => void } = {},
    ): Promise<T> => {
      if (phase === 'stroking') return factory()

      const memoStore = this.strokeMemo.get(path) ?? new WeakMap()
      let memoEntry = memoStore?.get(brush)
      let data: T | undefined = undefined

      if (memoEntry && shallowEquals(memoEntry.prevDeps, deps)) {
        return memoEntry.data
      }

      if (memoEntry) {
        disposer?.(memoEntry.data)
      }

      data = factory()
      memoEntry = { data, prevDeps: deps }

      memoStore.set(brush, memoEntry)
      this.strokeMemo.set(path, memoStore)

      return memoEntry.data
    }

    try {
      const result = saveAndRestoreCanvas(output, async () => {
        return await brush.render({
          abort: abort ?? new AbortController().signal,
          throwIfAborted: () => {
            if (abort?.aborted) throw new PPLCAbortError()
          },
          destContext: output,
          pixelRatio,
          threeRenderer: renderer,
          threeCamera: this.camera,

          brushSetting: deepClone(brushSetting),
          ink: ink.getInkGenerator({}),
          path: [path],
          destSize: {
            width: output.canvas.width,
            height: output.canvas.height,
          },
          transform: {
            translate: { x: transform.position.x, y: transform.position.y },
            scale: { x: transform.scale.x, y: transform.scale.y },
            rotate: transform.rotate,
          },
          phase,
          logger: logger ?? new RenderCycleLogger(),
          useMemoForPath,
        })
      })

      return result
    } finally {
      this.glRendererResource.release(renderer)
      this.strokeRenderLock.release(strokeRenderLock)
    }
  }
}
