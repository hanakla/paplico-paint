import { VectorGroup, VectorObject, VectorPath } from '@/Document'
import { TextLayer, VectorLayer } from '@/Document/LayerEntity'
import { InkSetting } from '@/Document/LayerEntity/InkSetting'
import { VectorStrokeSetting } from '@/Document/LayerEntity/VectorStrokeSetting'
import { PaplicoAbortError } from '@/Errors'
import { UIStroke } from '@/UI/UIStroke'
import { AtomicResource } from '@/utils/AtomicResource'
import {
  clearCanvas,
  saveAndRestoreCanvas,
  setCanvasSize,
} from '@/utils/canvas'
import { deepClone } from '@/utils/object'
import { OrthographicCamera, WebGLRenderer } from 'three'
import { BrushRegistry } from './Registry/BrushRegistry'
import { createCanvas, createContext2D } from './CanvasFactory'
import { InkRegistry } from './Registry/InkRegistry'
import { RenderCycleLogger } from './RenderCycleLogger'
import { RenderPhase, Viewport } from './types'
import {
  addPoint2D,
  calcVectorBoundingBox,
  layerTransformToMatrix,
  mapPoints,
  matrixToCanvasMatrix,
  multiplyPoint2D,
  svgCommandToVectoPath,
  vectorObjectTransformToMatrix,
} from './VectorUtils'
import { AppearanceRegistry } from './Registry/AppearanceRegistry'
import { FontRegistry } from './Registry/FontRegistry'
import { parseSVGPath, pathCommandsToString } from '@/VectorProcess'
import { createSVGPathByVectorPath } from '@/utils/svg'
import { TextNode } from '@/Document/LayerEntity/TextNode'

export type VectorObjectOverrides = {
  [vectorLayerUid: string]: {
    [vectorObjectId: string]: (base: VectorObject) => VectorObject
  }
}

export class VectorRenderer {
  protected brushRegistry: BrushRegistry
  protected inkRegistry: InkRegistry
  protected filterRegistry: AppearanceRegistry
  protected fontRegistry: FontRegistry

  protected glRendererResource: AtomicResource<WebGLRenderer>

  protected camera: OrthographicCamera

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
  ): Promise<void> {
    const { logger } = options

    setCanvasSize(output, options.viewport)
    const outcx = output.getContext('2d')!

    let objects: (VectorObject | VectorGroup)[] = []
    if (layer.layerType === 'text') {
      objects = await this.generateTextVectorObject(layer)
      console.log({ objects })
    } else {
      objects = layer.objects
    }

    for (let obj of objects) {
      if (obj.type === 'vectorGroup') continue
      if (!obj.visible) continue

      if (options.objectOverrides?.[layer.uid]?.[obj.uid]) {
        obj = options.objectOverrides?.[layer.uid]?.[obj.uid]!(deepClone(obj))
      }

      await saveAndRestoreCanvas(outcx, async () => {
        outcx.globalCompositeOperation = 'source-over'

        outcx.transform(
          ...matrixToCanvasMatrix(
            vectorObjectTransformToMatrix(obj).multiply(
              layerTransformToMatrix(layer.transform),
            ),
          ),
        )
        outcx.beginPath()

        const [start] = obj.path.points
        outcx.moveTo(start.x, start.y)

        mapPoints(
          obj.path.points,
          (point, prev) => {
            outcx.bezierCurveTo(
              point.begin?.x ?? prev!.x,
              point.begin?.y ?? prev!.y,
              point.end?.x ?? point.x,
              point.end?.y ?? point.y,
              point.x,
              point.y,
            )
          },
          { startOffset: 1 },
        )

        if (obj.path.closed) outcx.closePath()

        for (const ap of obj.filters) {
          if (ap.kind === 'fill') {
            switch (ap.fill.type) {
              case 'fill': {
                const {
                  color: { r, g, b },
                  opacity,
                } = ap.fill

                outcx.globalAlpha = 1
                outcx.fillStyle = `rgba(${r * 255}, ${g * 255}, ${
                  b * 255
                }, ${opacity})`
                outcx.fill()
                break
              }
              case 'linear-gradient': {
                const { colorStops: colorPoints, opacity, start, end } = ap.fill
                const { width, height, left, top } = calcVectorBoundingBox(obj)

                // const width = right - left
                // const height = bottom - top
                const centerX = left + width / 2
                const centerY = top + height / 2

                const gradient = outcx.createLinearGradient(
                  centerX + start.x,
                  centerY + start.y,
                  centerX + end.x,
                  centerY + end.y,
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

                outcx.globalAlpha = opacity
                outcx.fillStyle = gradient
                outcx.fill()
                break
              }
            }
          } else if (ap.kind === 'stroke') {
            const brush = this.brushRegistry.getInstance(ap.stroke.brushId)

            if (brush == null) {
              throw new Error(`Unregistered brush ${ap.stroke.brushId}`)
            }

            await this.renderStroke(output, obj.path, ap.stroke, {
              abort: options.abort,
              inkSetting: ap.ink,
              transform: {
                position: addPoint2D(
                  layer.transform.position,
                  obj.transform.position,
                ),
                scale: multiplyPoint2D(
                  layer.transform.scale,
                  obj.transform.scale,
                ),
                rotation: layer.transform.rotate + obj.transform.rotate,
              },
              phase: options.phase,
              logger: options.logger,
            })
          } else if (ap.kind === 'external') {
            continue
          }
        }
      })

      outcx.resetTransform()
    }
  }

  // protected async renderPath() {}

  public async generateTextVectorObject(layer: TextLayer) {
    if (!layer.visible) return []

    const objects: VectorObject[] = []

    let curX = 0
    let curBaseline = 0

    // Linebreak nomarlize
    const lineBreakedNodes: TextNode[] = []
    let currentNode: TextNode = { ...layer.textNodes[0], text: '' }

    for (
      let nodeIdx = 0, nodeLen = layer.textNodes.length;
      nodeIdx < nodeLen;
      nodeIdx++
    ) {
      let node = layer.textNodes[nodeIdx]

      lineBreakedNodes.push(currentNode)
      currentNode = { ...layer.textNodes[0], ...node, text: '' }

      for (
        let charIdx = 0, chars = [...node.text], charLen = chars.length;
        charIdx < charLen;
        charIdx++
      ) {
        if (chars[charIdx] === '\n') {
          lineBreakedNodes.push(currentNode)
          currentNode = { ...node, text: '' }
          break
        } else {
          currentNode.text += chars[charIdx]
        }
      }
    }

    lineBreakedNodes.push(currentNode)

    console.log({ lineBreakedNodes })
    for (const node of lineBreakedNodes) {
      const font = await this.fontRegistry.getFont(
        node.fontFamily ?? layer.fontFamily,
        node.fontStyle ?? layer.fontStyle,
        { fallback: { family: 'Hiragino Sans' } },
      )

      if (!font) {
        console.warn(
          `Font not found: ${node.fontFamily ?? layer.fontFamily} ${
            node.fontStyle ?? layer.fontStyle
          }`,
        )
        continue
      }

      const glyphs = font.stringToGlyphs(node.text)

      for (let glyph of glyphs) {
        const fontSize = node.fontSize ?? layer.fontSize
        // SEE: https://github.com/opentypejs/opentype.js/blob/8fbc2bad758e66e9a65da3bd2a0f9fd9c3d93dca/src/glyph.js#L349C5-L349C49
        const scale = (1 / glyph.path.unitsPerEm) * fontSize

        const path = glyph.getPath(
          curX,
          /* baseline */ glyph.yMin! * scale + curBaseline + 20,
          fontSize,
        )
        curX += glyph.advanceWidth! * scale

        const charPaths = svgCommandToVectoPath(path.toPathData(5))
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

    return objects
  }

  public async renderVectorObject(
    dest: HTMLCanvasElement,
    path: VectorPath,
  ): Promise<void> {
    const dstctx = dest.getContext('2d')!

    // const brush = this.brushRegistry.getInstance('stroke')
    // if (!brush) return

    const [start, ...points] = path.points

    dstctx.strokeStyle = '#000'
    dstctx.lineWidth = 2

    dstctx.beginPath()
    dstctx.moveTo(start.x, start.y)
    for (const point of points) dstctx.lineTo(point.x, point.y)
    dstctx.stroke()
  }

  public async renderStroke(
    dest: HTMLCanvasElement,
    path: VectorPath,
    strokeSetting: VectorStrokeSetting,
    {
      inkSetting,
      transform,
      abort,
      phase,
      logger,
    }: {
      inkSetting: InkSetting
      transform: {
        position: { x: number; y: number }
        scale: { x: number; y: number }
        rotation: number
      }
      abort?: AbortSignal
      phase: RenderPhase
      logger: RenderCycleLogger
    },
  ): Promise<void> {
    const brush = this.brushRegistry.getInstance(strokeSetting.brushId)
    const ink = this.inkRegistry.getInstance(inkSetting.inkId)

    if (!brush) throw new Error(`Unregistered brush ${strokeSetting.brushId}`)
    if (!ink) throw new Error(`Unregistered ink ${inkSetting.inkId}`)

    const renderer = await this.glRendererResource.ensure()
    const dstctx = dest.getContext('2d')!
    const { width, height } = dest

    renderer.setSize(width, height, false)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()

    this.camera.left = -width / 2.0
    this.camera.right = width / 2.0
    this.camera.top = height / 2.0
    this.camera.bottom = -height / 2.0
    this.camera.updateProjectionMatrix()

    try {
      await brush.render({
        abort: abort ?? new AbortController().signal,
        abortIfNeeded: () => {
          if (abort?.aborted) throw new PaplicoAbortError()
        },
        destContext: dstctx,
        threeRenderer: renderer,
        threeCamera: this.camera,

        brushSetting: deepClone(strokeSetting),
        ink: ink.getInkGenerator({}),
        path: [path],
        destSize: { width: dest.width, height: dest.height },
        transform: {
          translate: { x: transform.position.x, y: transform.position.y },
          scale: { x: transform.scale.x, y: transform.scale.y },
          rotate: transform.rotation,
        },
        phase,
        logger,
      })
    } finally {
      this.glRendererResource.release(renderer)
    }
  }
}
