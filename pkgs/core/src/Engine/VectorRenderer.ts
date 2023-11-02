import {
  VectorFillSetting,
  VectorGroup,
  VectorObject,
  VectorPath,
} from '@/Document'
import { LayerTransform, TextLayer, VectorLayer } from '@/Document/LayerEntity'
import { InkSetting } from '@/Document/LayerEntity/InkSetting'
import { VectorStrokeSetting } from '@/Document/LayerEntity/VectorStrokeSetting'
import { PaplicoAbortError } from '@/Errors'
import { AtomicResource } from '@/utils/AtomicResource'
import { saveAndRestoreCanvas, setCanvasSize } from '@/utils/canvas'
import { deepClone, shallowEquals } from '@/utils/object'
import { OrthographicCamera, WebGLRenderer } from 'three'
import { BrushRegistry } from './Registry/BrushRegistry'
import { InkRegistry } from './Registry/InkRegistry'
import { RenderCycleLogger } from './RenderCycleLogger'
import { RenderPhase, Viewport } from './types'
import {
  addPoint2D,
  calcVectorBoundingBox,
  calcVectorPathBoundingBox,
  layerTransformToMatrix,
  matrixToCanvasMatrix,
  multiplyPoint2D,
  svgCommandToVectoPath,
  vectorObjectTransformToMatrix,
} from './VectorUtils'
import { AppearanceRegistry } from './Registry/AppearanceRegistry'
import { FontRegistry } from './Registry/FontRegistry'
import { TextNode } from '@/Document/LayerEntity/TextNode'
import { BrushLayoutData, IBrush } from './Brush/Brush'
import {
  LayerMetrics,
  createBBox,
  createEmptyBBox,
} from './DocumentContext/LayerMetrics'
import { VectorAppearance } from '@/Document/LayerEntity/VectorAppearance'
import { PaplicoRenderWarn } from '@/Errors/PaplicoRenderWarn'
import { reduceAsync } from '@/utils/array'
import { MissingFilterWarn } from '@/Errors/Warns/MissingFilterWarn'

export type VectorObjectOverrides = {
  [vectorLayerUid: string]: {
    [vectorObjectId: string]: (base: VectorObject) => VectorObject
  }
}

type StrokeMemoEntry<T> = {
  data: T
  prevDeps: any[]
}

export class VectorRenderer {
  protected brushRegistry: BrushRegistry
  protected inkRegistry: InkRegistry
  protected filterRegistry: AppearanceRegistry
  protected fontRegistry: FontRegistry

  protected glRendererResource: AtomicResource<WebGLRenderer>

  protected camera: OrthographicCamera
  protected strokeMemo: WeakMap<
    VectorPath,
    WeakMap<IBrush, StrokeMemoEntry<any>>
  > = new WeakMap()

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

  public async invalidateStrokeMemo(path: VectorPath) {
    this.strokeMemo.delete(path)
  }

  public async renderVectorLayer(
    output: HTMLCanvasElement,
    layer: VectorLayer | TextLayer,
    options: {
      viewport: Viewport
      pixelRatio: number
      abort?: AbortSignal
      logger: RenderCycleLogger
      phase: RenderPhase
      objectOverrides?: VectorObjectOverrides
    },
  ): Promise<{
    layerBBox: {
      source: LayerMetrics.BBox
      visually: LayerMetrics.BBox
    }
    objectsBBox: {
      [objectUid: string]: {
        source: LayerMetrics.BBox
        visually: LayerMetrics.BBox
      }
    }
  }> {
    const { logger, pixelRatio } = options

    setCanvasSize(output, options.viewport)
    const outcx = output.getContext('2d')!
    const objectsBBox: Record<string, LayerMetrics.BBoxSet> = {}

    let objects: (VectorObject | VectorGroup)[] = []
    if (layer.layerType === 'text') {
      objects = await this.generateTextVectorObject(layer)
    } else {
      objects = layer.objects
    }

    for (let obj of objects) {
      if (obj.type === 'vectorGroup') return
      if (!obj.visible) continue

      const sourceBBox = calcVectorBoundingBox(obj) // Ignore override for source
      let visuallyBBox = sourceBBox

      if (options.objectOverrides?.[layer.uid]?.[obj.uid]) {
        obj = options.objectOverrides?.[layer.uid]?.[obj.uid]!(deepClone(obj))
      }

      await saveAndRestoreCanvas(outcx, async () => {
        if (obj.type === 'vectorGroup') return // for typecheck

        for (const ap of obj.filters) {
          if (ap.kind === 'fill') {
            this.renderFill(outcx, obj.path, ap.fill, {
              pixelRatio: options.pixelRatio,
              transform: {
                position: addPoint2D(
                  layer.transform.position,
                  obj.transform.position,
                ),
                scale: multiplyPoint2D(
                  layer.transform.scale,
                  obj.transform.scale,
                ),
                rotate: layer.transform.rotate + obj.transform.rotate,
              },
              phase: options.phase,
              abort: options.abort,
              logger: options.logger,
            })
          } else if (ap.kind === 'stroke') {
            const brush = this.brushRegistry.getInstance(ap.stroke.brushId)

            if (brush == null) {
              throw new Error(`Unregistered brush ${ap.stroke.brushId}`)
            }

            const { bbox } = await this.renderStroke(
              output,
              obj.path,
              ap.stroke,
              {
                abort: options.abort,
                inkSetting: ap.ink,
                pixelRatio,
                transform: {
                  position: addPoint2D(
                    layer.transform.position,
                    obj.transform.position,
                  ),
                  scale: multiplyPoint2D(
                    layer.transform.scale,
                    obj.transform.scale,
                  ),
                  rotate: layer.transform.rotate + obj.transform.rotate,
                },
                phase: options.phase,
                logger: options.logger,
              },
            )

            visuallyBBox = {
              ...bbox,
              width: bbox.right - bbox.left,
              height: bbox.bottom - bbox.top,
              centerX: bbox.left + (bbox.right - bbox.left) / 2,
              centerY: bbox.top + (bbox.bottom - bbox.top) / 2,
            }
          } else if (ap.kind === 'external') {
            continue
          }
        }
      })

      objectsBBox[obj.uid] = {
        source: sourceBBox,
        visually: visuallyBBox,
      }

      outcx.resetTransform()
    }

    let layerSourceBBox: LayerMetrics.BBox = createEmptyBBox()
    let layerVisuallyBBox: LayerMetrics.BBox = createEmptyBBox()

    for (const obj of objects) {
      const { source, visually } = objectsBBox[obj.uid]

      layerSourceBBox.left = Math.min(layerSourceBBox.left, source.left)
      layerSourceBBox.top = Math.min(layerSourceBBox.top, source.top)
      layerSourceBBox.width = Math.max(layerSourceBBox.width, source.width)
      layerSourceBBox.height = Math.max(layerSourceBBox.height, source.height)

      layerVisuallyBBox.left = Math.min(layerVisuallyBBox.left, visually.left)
      layerVisuallyBBox.top = Math.min(layerVisuallyBBox.top, visually.top)
      layerVisuallyBBox.width = Math.max(
        layerVisuallyBBox.width,
        visually.width,
      )
      layerVisuallyBBox.height = Math.max(
        layerVisuallyBBox.height,
        visually.height,
      )
    }

    return {
      layerBBox: {
        source: createBBox(layerSourceBBox),
        visually: createBBox(layerVisuallyBBox),
      },
      objectsBBox: objectsBBox,
    }
  }

  // protected async renderPath() {}

  public async generateTextVectorObject(layer: TextLayer) {
    if (!layer.visible) return []

    const objects: VectorObject[] = []

    let curX = layer.transform.position.x
    let curY = layer.transform.position.y
    let curBaseline = 0

    // #region Linebreak nomarlize
    const lineBreakedNodes: TextNode[][] = []
    let currentLine: TextNode[] = []
    let currentNode: TextNode

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

    console.log({ lineBreakedNodes })
    for (const lineNodes of lineBreakedNodes) {
      const loadFont = (node: TextNode) => {
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
          console.warn(
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

          console.log({ maxLineHeightPx, glyphHeightPx, unitToPxScale })
          const path = glyph.getPath(curX, curY + maxLineHeightPx, fontSize)

          curX += glyph.advanceWidth! * unitToPxScale

          const metrics = glyph.getMetrics()
          const charPaths = svgCommandToVectoPath(path.toPathData(5))

          console.log(metrics)

          for (let path of charPaths) {
            objects.push({
              uid: '__TEXT__',
              type: 'vectorObject',
              lock: false,
              name: '',
              opacity: 1,
              path,
              visible: true,
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
                  kind: 'fill',
                  fill: {
                    type: 'fill',
                    color: { r: 0, g: 0, b: 0 },
                    opacity: 1,
                  },
                },
              ],
            })
          }
        }
      }
    }

    return objects
  }

  public async renderFill(
    outcx: CanvasRenderingContext2D,
    path: VectorPath,
    fillSetting: VectorFillSetting,
    {
      transform,
      pixelRatio,
      abort,
      phase = 'final',
      logger,
      filtersForPathTransform = [],
    }: {
      transform: LayerTransform
      pixelRatio: number
      abort?: AbortSignal
      phase: RenderPhase
      logger: RenderCycleLogger
      filtersForPathTransform?: VectorAppearance[]
    },
  ): Promise<{
    warns: PaplicoRenderWarn[]
  }> {
    let warns: PaplicoRenderWarn[] = []

    const transformedPath = await reduceAsync(
      filtersForPathTransform,
      async (path, filter) => {
        if (filter.kind !== 'external') return path

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
          cx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${b * 255}, ${opacity})`
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

    return { warns }
  }

  public async renderStroke(
    dest: HTMLCanvasElement,
    path: VectorPath,
    strokeSetting: VectorStrokeSetting,
    {
      inkSetting,
      transform,
      pixelRatio,
      abort,
      phase,
      logger,
    }: {
      inkSetting: InkSetting
      transform: LayerTransform
      pixelRatio: number
      abort?: AbortSignal
      phase: RenderPhase
      logger: RenderCycleLogger
    },
  ): Promise<BrushLayoutData> {
    const brush = this.brushRegistry.getInstance(strokeSetting.brushId)
    const ink = this.inkRegistry.getInstance(inkSetting.inkId)

    if (!brush) throw new Error(`Unregistered brush ${strokeSetting.brushId}`)
    if (!ink) throw new Error(`Unregistered ink ${inkSetting.inkId}`)

    const renderer = await this.glRendererResource.ensure()
    const dstctx = dest.getContext('2d')!
    const width = dest.width * pixelRatio
    const height = dest.height * pixelRatio

    renderer.setSize(width, height, false)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()

    this.camera.left = -width / 2.0
    this.camera.right = width / 2.0
    this.camera.top = height / 2.0
    this.camera.bottom = -height / 2.0
    this.camera.updateProjectionMatrix()

    const useMemoForPath = async <T>(
      path: VectorPath,
      factory: () => T,
      deps: any[],
      { disposer }: { disposer?: (obj: T) => void } = {},
    ): Promise<T> => {
      if (phase === 'stroking') return factory()

      const memoStore = this.strokeMemo.get(path) ?? new WeakMap()
      let memoEntry = memoStore?.get(brush)
      let data: T | undefined = undefined

      if (!memoEntry || !shallowEquals(memoEntry.prevDeps, deps)) {
        if (memoEntry) {
          disposer?.(memoEntry.data)
        }
        data = factory()
        memoEntry = { data, prevDeps: deps }
      }

      memoStore.set(brush, memoEntry)
      this.strokeMemo.set(path, memoStore)

      return memoEntry.data
    }

    try {
      return saveAndRestoreCanvas(dstctx, async () => {
        return await brush.render({
          abort: abort ?? new AbortController().signal,
          abortIfNeeded: () => {
            if (abort?.aborted) throw new PaplicoAbortError()
          },
          destContext: dstctx,
          pixelRatio,
          threeRenderer: renderer,
          threeCamera: this.camera,

          brushSetting: deepClone(strokeSetting),
          ink: ink.getInkGenerator({}),
          path: [path],
          destSize: { width: dest.width, height: dest.height },
          transform: {
            translate: { x: transform.position.x, y: transform.position.y },
            scale: { x: transform.scale.x, y: transform.scale.y },
            rotate: transform.rotate,
          },
          phase,
          logger,
          useMemoForPath,
        })
      })
    } finally {
      this.glRendererResource.release(renderer)
    }
  }
}
