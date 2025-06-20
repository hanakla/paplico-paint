import { EngineState, Vector2, RenderDebugInfo } from '../state'
import { proxy } from 'valtio'
import { StrokeRenderer } from './appearances/stroke-renderer'
import { FillRenderer } from './appearances/fill-renderer'
import { CanvasRenderer } from './appearances/canvas-renderer'
import {
  Appearance,
  isFillAppearance,
  isStrokeAppearance,
} from '../document/appearance'
import { ArtObject, isCanvasArtObject } from '../document/art-object'
import { LayerNode } from '../document/layer'
import { VectorPath } from '../document/path'
import { Document, createDocument } from '../document/document'
import { Camera2D } from '../camera/camera-2d'
import {
  IAppearanceProcessor,
  BoundingBox,
} from './interfaces/IAppearanceProcessor'
import { LayerCompositor } from './compositing/layer-compositor'
import { OffscreenTexturePool } from './compositing/offscreen-texture-pool'
import { UIManager, WebGPUIDeclaration, WebGPUComponentContext } from './ui'
import { DocumentContext } from '../document-manager'
import { IWebGPUUIComponent } from './ui/IWebGPUUIComponent'
import { UIComponentManager } from './ui/ui-component-manager'
import { HitTester } from './hit-test/hit-test'
import type { HitTestResult } from './hit-test/types'
import { setDocumentAccessFunction } from '../selection-state'

// WebGPU Debug State
export const debugState = proxy({
  capturedFrame: null as RenderDebugInfo | null,
  isCapturing: false,
  showStats: false,
  hitTest: {
    lastHitPosition: null as Vector2 | null,
    lastHitResults: [] as any[],
    hitCount: 0,
  },
  ui: {
    componentCount: 0,
    renderOrder: [] as string[],
    lastRenderTime: 0,
    elementsGenerated: 0,
    elementsRendered: 0,
    renderPasses: {
      background: { count: 0, duration: 0 },
      foreground: { count: 0, duration: 0 },
      legacy: { count: 0, duration: 0 },
    },
    activeComponents: [] as string[],
    errorCount: 0,
    lastError: null as string | null,
    drawOrder: [] as Array<{
      type:
        | 'ui-background'
        | 'ui-foreground'
        | 'ui-legacy'
        | 'artobjects'
        | 'compositions'
      elementId?: string
      elementType?: string
      zIndex?: number
      timestamp: number
      position?: { x: number; y: number }
      size?: { width: number; height: number }
    }>,
    renderCalls: [] as Array<{
      callType: 'setPipeline' | 'draw' | 'setVertexBuffer' | 'setBindGroup'
      pipelineType?: 'text' | 'surface' | 'stroke' | 'fill'
      elementId?: string
      timestamp: number
    }>,
  },
  stroke: {
    renderer: {
      initialized: false,
      hasRenderPipeline: false,
      hasComputePipeline: false,
      isGPUComputeAvailable: false,
      lastInitError: null as string | null,
      initStackTrace: null as string | null,
    },
    webgpuUtils: {
      shaderDataDefs: null as any,
      uniformsAvailable: [] as string[],
      structsAvailable: [] as string[],
      lastParseError: null as string | null,
      uniformsView: null as any,
    },
    rendering: {
      callCount: 0,
      lastCallTime: 0,
      lastPathPointCount: 0,
      lastInstanceCount: 0,
      lastArtObjectId: null as string | null,
      lastError: null as string | null,
      lastErrorStack: null as string | null,
      lastErrorLocation: null as string | null,
      renderDuration: 0,
      computeDuration: 0,
      lastSuccessTime: 0,
      failureCount: 0,
      successCount: 0,
    },
    pipeline: {
      lastVertexBufferSize: 0,
      lastIndexBufferSize: 0,
      lastInstanceBufferSize: 0,
      lastUniformBufferSize: 0,
      lastBindGroupCreated: false,
      lastDrawIndexedCalls: 0,
    },
    document: {
      layerCount: 0,
      artObjectCount: 0,
      visibleLayerCount: 0,
      strokeLayerCount: 0,
      strokeArtObjectCount: 0,
      lastDocumentId: null as string | null,
    },
  },
  selection: {
    selectedObjectsCount: 0,
    selectedVerticesCount: 0,
    selectionMode: 'object' as 'object' | 'vertex',
    lastSelectionUpdateTime: 0,
    boundingBoxAvailable: false,
    boundingBox: null as {
      x: number
      y: number
      width: number
      height: number
    } | null,
  },
  movement: {
    lastMoveCommand: {
      timestamp: null as number | null,
      objectIds: [] as string[],
      offset: null as { x: number; y: number } | null,
      success: false,
      errorMessage: null as string | null,
    },
    drag: {
      isDragging: false,
      startPosition: null as { x: number; y: number } | null,
      currentPosition: null as { x: number; y: number } | null,
      currentOffset: null as { x: number; y: number } | null,
      selectedObjectIds: [] as string[],
    },
    objectTransforms: {
      before: {} as Record<string, { x: number; y: number }>,
      after: {} as Record<string, { x: number; y: number }>,
      lastUpdateTime: null as number | null,
    },
    executionLog: [] as Array<{
      timestamp: number
      action:
        | 'start_drag'
        | 'update_drag'
        | 'end_drag'
        | 'execute_command'
        | 'object_moved'
      data: any
    }>,
  },
  export: {
    artboard: {
      name: null as string | null,
      bounds: null as {
        x: number
        y: number
        width: number
        height: number
      } | null,
      artObjectsInside: 0,
      renderStartTime: 0,
      renderEndTime: 0,
    },
    texture: {
      width: 0,
      height: 0,
      format: null as string | null,
      created: false,
      readStartTime: 0,
      readEndTime: 0,
      bytesRead: 0,
    },
    camera: {
      originalPosition: null as { x: number; y: number } | null,
      originalZoom: 0,
      newPosition: null as { x: number; y: number } | null,
      newZoom: 0,
    },
    imageData: {
      width: 0,
      height: 0,
      alphaMin: 255,
      alphaMax: 0,
      nonTransparentPixels: 0,
      totalPixels: 0,
    },
    errors: [] as string[],
    lastExportTime: 0,
    rendering: {
      layersProcessed: 0,
      artObjectsProcessed: 0,
      visibleLayers: 0,
      pathsRendered: 0,
      fillsRendered: 0,
      strokesRendered: 0,
      skippedObjects: 0,
      renderErrors: [] as Array<{
        artObjectId: string
        artObjectType: string
        appearanceType?: string
        error: string
        timestamp: number
      }>,
    },
  },
})

export class WebGPUEngine {
  private canvas: HTMLCanvasElement
  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private renderPipeline: GPURenderPipeline | null = null
  private lineRenderPipeline: GPURenderPipeline | null = null
  private textRenderPipeline: GPURenderPipeline | null = null
  private simpleFillPipeline: GPURenderPipeline | null = null
  private strokeRenderer: StrokeRenderer | null = null
  private fillRenderer: FillRenderer | null = null
  private canvasRenderer: CanvasRenderer | null = null
  private uniformBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private lastFrameTime = 0
  private frameCount = 0
  private fpsUpdateTime = 0
  private camera: Camera2D
  public state: EngineState
  private currentRenderTargetTexture: GPUTexture | null = null

  // オフスクリーン合成用の追加プロパティ
  private layerCompositor: LayerCompositor | null = null
  private offscreenTexturePool: OffscreenTexturePool | null = null

  // UIレンダリングシステム
  private uiManager: UIManager | null = null

  // WebGPU UIコンポーネントマネージャー
  private uiComponentManager: UIComponentManager | null = null

  // 一時ストローク管理
  private currentTempStrokeId: string | null = null

  // デバッグ情報収集用
  private frameNumber = 0
  private currentRenderDebugInfo: RenderDebugInfo | null = null
  private adapter: GPUAdapter | null = null
  private renderCallCount: Map<string, number> | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.camera = new Camera2D()

    // engineStateをWebGPUEngine内で初期化
    this.state = proxy<EngineState>({
      canvas: {
        width: 1920,
        height: 1080,
        backgroundColor: { r: 0, g: 0, b: 0, a: 0 },
      },
      viewport: {
        x: 0,
        y: 0,
        zoom: 1,
        rotation: 0,
        width: canvas.width || 800,
        height: canvas.height || 600,
      },
      strokeSettings: {
        width: 10,
        color: { r: 0, g: 0, b: 0, a: 1 },
        style: 'solid',
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 1,
        blendMode: 'normal',
        brushSettings: {
          texture: 'pencil',
          scatterConfig: {
            count: 5,
            spread: 10,
            sizeVariation: 0.2,
            opacityVariation: 0.1,
          },
          rotationAdjust: 1,
          randomRotation: 0,
          randomScale: 0,
          inOutInfluence: 1,
          inOutLength: 100,
          divisions: 1000,
          pressureInfluence: 0.8,
          noiseInfluence: 0,
          pressureSizeInfluence: 0.8,
          pressureOpacityInfluence: 0.6,
          tiltInfluence: 0.3,
          velocitySizeInfluence: 0.4,
          velocityOpacityInfluence: 0.2,
          minSizeRatio: 0.1,
          minOpacity: 0.1,
        },
      },
      tools: {
        activeTool: 'brush',
        isDrawing: false,
        currentStroke: null,
      },
      selection: {
        selectedObjectIds: [],
        isDragging: false,
        dragStartPosition: null,
        dragOffset: null,
      },
      ui: {
        showLayers: true,
        showBrushSettings: false,
        showFilters: false,
        showDebug: false,
        debugPaneOpen: false,
        sidebarWidth: 300,
        debugPaneWidth: 320,
      },
      performance: {
        fps: 60,
        frameTime: 16.67,
        webgpuDevice: null,
        webgpuContext: null,
      },
      history: {
        undoStack: [],
        redoStack: [],
        maxHistory: 50,
      },
      debug: debugState,
      document: createDocument({
        name: 'Test Document',
      }),
    })

    // debugStateの選択状態を初期化
    debugState.selection.selectedObjectsCount = 0
    debugState.selection.selectedVerticesCount = 0
    debugState.selection.selectionMode = 'object'
    debugState.selection.lastSelectionUpdateTime = 0
    debugState.selection.boundingBoxAvailable = false
    debugState.selection.boundingBox = null
  }

  async initialize(): Promise<boolean> {
    try {
      if (!navigator.gpu) {
        return false
      }

      const adapter = await navigator.gpu.requestAdapter()

      if (!adapter) {
        return false
      }

      this.adapter = adapter
      this.device = await adapter.requestDevice()

      // WebGPUエラーイベントリスナーを設定
      this.device.addEventListener('uncapturederror', async (event: any) => {
        console.error('WebGPU uncaptured error:', event.error)
        debugState.ui.errorCount++
        debugState.ui.lastError = `WebGPU uncaptured error: ${event.error.message}`
      })

      this.device.lost.then(async (info: any) => {
        console.error('WebGPU device lost:', info)
        debugState.ui.errorCount++
        debugState.ui.lastError = `WebGPU device lost: ${
          info.reason || 'unknown'
        }`
      })

      this.context = this.canvas.getContext('webgpu')

      if (!this.context) {
        return false
      }

      const canvasFormat = navigator.gpu.getPreferredCanvasFormat()

      this.context.configure({
        device: this.device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
      })

      await this.createRenderPipeline()
      await this.createLineRenderPipeline()
      await this.createTextRenderPipeline()
      await this.createSimpleFillPipeline()
      this.createUniformBuffer()

      // ストロークレンダラーを初期化
      this.strokeRenderer = new StrokeRenderer(this.device)
      try {
        await this.strokeRenderer.initialize()
        debugState.stroke.renderer.initialized = true
        debugState.stroke.renderer.hasRenderPipeline = !!(
          this.strokeRenderer as any
        ).renderPipeline
        debugState.stroke.renderer.hasComputePipeline = !!(
          this.strokeRenderer as any
        ).computePipeline
        debugState.stroke.renderer.isGPUComputeAvailable = (
          this.strokeRenderer as any
        ).isGPUComputeAvailable
      } catch (error) {
        debugState.stroke.renderer.lastInitError =
          error instanceof Error ? error.message : String(error)
        debugState.stroke.renderer.initStackTrace =
          error instanceof Error ? error.stack || null : null
        throw error
      }

      // フィルレンダラーを初期化
      this.fillRenderer = new FillRenderer(this.device)
      await this.fillRenderer.initialize()

      // キャンバスレンダラーを初期化
      this.canvasRenderer = new CanvasRenderer(this.device)
      await this.canvasRenderer.initialize()

      // オフスクリーン合成システムを初期化
      this.offscreenTexturePool = new OffscreenTexturePool(this.device)
      this.layerCompositor = new LayerCompositor(
        this.device,
        this.offscreenTexturePool,
      )
      await this.layerCompositor.initialize()

      // UIコンポーネントマネージャーを初期化
      this.uiComponentManager = new UIComponentManager(this.device)
      await this.uiComponentManager.initialize()

      this.uiManager = new UIManager()

      // キャンバスにマウスイベントリスナーを追加
      this.setupMouseEventListeners()

      // WebGPU UIコンポーネントを初期化
      this.initializeUIComponents()

      // 選択システムにドキュメントアクセス関数を注入
      this.setupSelectionSystem()

      this.setWebGPUDevice(this.device, this.context)

      // テストドキュメントをロード

      // カメラをテストデータに合わせて調整
      this.camera.setPosition(400, 300)
      this.camera.setZoom(1.0)

      return true
    } catch (error) {
      throw error
    }
  }

  private async createRenderPipeline() {
    if (!this.device) return

    try {
      const vertexShaderCode = `
        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
        }

        @vertex
        fn vs_main(@location(0) position: vec2<f32>, @location(1) color: vec4<f32>) -> VertexOutput {
          var output: VertexOutput;
          output.position = vec4<f32>(position, 0.0, 1.0);
          output.color = color;
          return output;
        }
      `

      const fragmentShaderCode = `
        @fragment
        fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
          return color;
        }
      `

      const vertexShader = this.device.createShaderModule({
        label: 'VectorPaintVertexShader',
        code: vertexShaderCode,
      })

      const fragmentShader = this.device.createShaderModule({
        label: 'VectorPaintFragmentShader',
        code: fragmentShaderCode,
      })

      this.renderPipeline = this.device.createRenderPipeline({
        label: 'VectorPaintRenderPipeline',
        layout: 'auto',
        vertex: {
          module: vertexShader,
          entryPoint: 'vs_main',
          buffers: [
            {
              arrayStride: 6 * 4, // position(2) + color(4) = 6 floats
              attributes: [
                {
                  shaderLocation: 0,
                  offset: 0,
                  format: 'float32x2', // position
                },
                {
                  shaderLocation: 1,
                  offset: 2 * 4,
                  format: 'float32x4', // color
                },
              ],
            },
          ],
        },
        fragment: {
          module: fragmentShader,
          entryPoint: 'fs_main',
          targets: [
            {
              format: navigator.gpu.getPreferredCanvasFormat(),
              blend: {
                color: {
                  srcFactor: 'src-alpha',
                  dstFactor: 'one-minus-src-alpha',
                },
                alpha: {
                  srcFactor: 'one',
                  dstFactor: 'one-minus-src-alpha',
                },
              },
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none',
        },
        multisample: {
          count: 1,
        },
      })
    } catch (error) {
      throw error
    }
  }

  private async createLineRenderPipeline() {
    if (!this.device) return

    try {
      const vertexShaderCode = `
        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
        }

        @vertex
        fn vs_main(@location(0) position: vec2<f32>, @location(1) color: vec4<f32>) -> VertexOutput {
          var output: VertexOutput;
          output.position = vec4<f32>(position, 0.0, 1.0);
          output.color = color;
          return output;
        }
      `

      const fragmentShaderCode = `
        @fragment
        fn fs_main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
          return color;
        }
      `

      const vertexShader = this.device.createShaderModule({
        label: 'LineVertexShader',
        code: vertexShaderCode,
      })

      const fragmentShader = this.device.createShaderModule({
        label: 'LineFragmentShader',
        code: fragmentShaderCode,
      })

      this.lineRenderPipeline = this.device.createRenderPipeline({
        label: 'LineRenderPipeline',
        layout: 'auto',
        vertex: {
          module: vertexShader,
          entryPoint: 'vs_main',
          buffers: [
            {
              arrayStride: 6 * 4, // position(2) + color(4) = 6 floats
              attributes: [
                {
                  shaderLocation: 0,
                  offset: 0,
                  format: 'float32x2', // position
                },
                {
                  shaderLocation: 1,
                  offset: 2 * 4,
                  format: 'float32x4', // color
                },
              ],
            },
          ],
        },
        fragment: {
          module: fragmentShader,
          entryPoint: 'fs_main',
          targets: [
            {
              format: navigator.gpu.getPreferredCanvasFormat(),
              blend: {
                color: {
                  srcFactor: 'src-alpha',
                  dstFactor: 'one-minus-src-alpha',
                },
                alpha: {
                  srcFactor: 'one',
                  dstFactor: 'one-minus-src-alpha',
                },
              },
            },
          ],
        },
        primitive: {
          topology: 'line-list',
          cullMode: 'none',
        },
        multisample: {
          count: 1,
        },
      })
    } catch (error) {
      throw error
    }
  }

  private async createTextRenderPipeline() {
    if (!this.device) return

    try {
      const vertexShaderCode = `
        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) uv: vec2<f32>,
        }

        @vertex
        fn vs_main(@location(0) position: vec2<f32>, @location(1) uv: vec2<f32>) -> VertexOutput {
          var output: VertexOutput;
          output.position = vec4<f32>(position, 0.0, 1.0);
          output.uv = uv;
          return output;
        }
      `

      const fragmentShaderCode = `
        @group(0) @binding(0) var textureSampler: sampler;
        @group(0) @binding(1) var textTexture: texture_2d<f32>;

        @fragment
        fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
          return textureSample(textTexture, textureSampler, uv);
        }
      `

      const vertexShader = this.device.createShaderModule({
        label: 'TextVertexShader',
        code: vertexShaderCode,
      })

      const fragmentShader = this.device.createShaderModule({
        label: 'TextFragmentShader',
        code: fragmentShaderCode,
      })

      this.textRenderPipeline = this.device.createRenderPipeline({
        label: 'TextRenderPipeline',
        layout: 'auto',
        vertex: {
          module: vertexShader,
          entryPoint: 'vs_main',
          buffers: [
            {
              arrayStride: 4 * 4, // position(2) + uv(2) = 4 floats
              attributes: [
                {
                  shaderLocation: 0,
                  offset: 0,
                  format: 'float32x2', // position
                },
                {
                  shaderLocation: 1,
                  offset: 2 * 4,
                  format: 'float32x2', // uv
                },
              ],
            },
          ],
        },
        fragment: {
          module: fragmentShader,
          entryPoint: 'fs_main',
          targets: [
            {
              format: navigator.gpu.getPreferredCanvasFormat(),
              blend: {
                color: {
                  srcFactor: 'src-alpha',
                  dstFactor: 'one-minus-src-alpha',
                },
                alpha: {
                  srcFactor: 'one',
                  dstFactor: 'one-minus-src-alpha',
                },
              },
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none',
        },
        multisample: {
          count: 1,
        },
      })
    } catch (error) {
      throw error
    }
  }

  private async createSimpleFillPipeline() {
    if (!this.device) return

    try {
      const shaderCode = `
        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
        }

        @vertex
        fn vs_main(@location(0) position: vec2<f32>, @location(1) color: vec4<f32>) -> VertexOutput {
          var output: VertexOutput;
          output.position = vec4<f32>(position, 0.0, 1.0);
          output.color = color;
          return output;
        }

        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
          return input.color;
        }
      `

      const shaderModule = this.device.createShaderModule({
        label: 'SimpleFillShader',
        code: shaderCode,
      })

      this.simpleFillPipeline = this.device.createRenderPipeline({
        label: 'SimpleFillPipeline',
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [
            {
              arrayStride: 2 * 4, // position: vec2<f32>
              attributes: [
                {
                  shaderLocation: 0,
                  offset: 0,
                  format: 'float32x2', // position
                },
              ],
            },
            {
              arrayStride: 4 * 4, // color: vec4<f32>
              attributes: [
                {
                  shaderLocation: 1,
                  offset: 0,
                  format: 'float32x4', // color
                },
              ],
            },
          ],
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [
            {
              format: navigator.gpu.getPreferredCanvasFormat(),
              blend: {
                color: {
                  srcFactor: 'src-alpha',
                  dstFactor: 'one-minus-src-alpha',
                },
                alpha: {
                  srcFactor: 'one',
                  dstFactor: 'one-minus-src-alpha',
                },
              },
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none',
        },
        multisample: {
          count: 1,
        },
      })
    } catch (error) {
      throw error
    }
  }

  private createUniformBuffer() {
    // 簡略化のため一時的に無効化
    return
  }

  /**
   * 階層構造のレイヤーツリーをレンダリング
   */
  private async renderDownLayerTree(
    renderPass: GPURenderPassEncoder,
    buffersToDestroy: GPUBuffer[],
    documentContext: DocumentContext,
  ): Promise<void> {
    const document = documentContext.document

    // ドキュメント構造のレイヤーノードを使用
    const rootNodes = document.layerNodes
      .filter((node: any) => node.parentId === null)
      .sort((a: any, b: any) => a.order - b.order)

    // エクスポート時の場合は、処理対象のレイヤー数をエラーログに記録（初回のみ）
    if (debugState.export.rendering) {
      console.log('=== PNG Export Debug: Document Structure ===')
      console.log(
        `Document has ${Object.keys(document.layers).length} total layers`,
      )
      console.log(
        `Document has ${
          Object.keys(document.artObjects).length
        } total artObjects`,
      )
      console.log(`Root nodes found: ${rootNodes.length}`)
      console.log('document.layerNodes:', document.layerNodes)

      debugState.export.errors.push(`=== Document Structure ===`)
      debugState.export.errors.push(
        `Document has ${Object.keys(document.layers).length} total layers`,
      )
      debugState.export.errors.push(
        `Document has ${
          Object.keys(document.artObjects).length
        } total artObjects`,
      )
      debugState.export.errors.push(`Root nodes found: ${rootNodes.length}`)
      rootNodes.forEach((node, i) => {
        const layer = document.layers[node.layerId]
        console.log(
          `Root ${i}: Layer ${node.layerId} visible=${layer?.visible} type=${layer?.type}`,
        )
        debugState.export.errors.push(
          `Root ${i}: Layer ${node.layerId} visible=${layer?.visible} type=${layer?.type}`,
        )

        // ベクターレイヤーのアートオブジェクト情報も記録
        if (layer?.type === 'vector' && (layer as any).artObjectIds) {
          const vectorLayer = layer as any
          console.log(
            `  - Contains ${vectorLayer.artObjectIds.length} art objects`,
          )
          debugState.export.errors.push(
            `  - Contains ${vectorLayer.artObjectIds.length} art objects`,
          )
        }
      })
    }

    for (const node of rootNodes) {
      await this.renderDownLayerTreeInner(
        renderPass,
        node,
        buffersToDestroy,
        1.0,
        documentContext,
      )
    }
  }

  /**
   * レイヤーノードを再帰的にレンダリング（階層構造対応）
   */
  private async renderDownLayerTreeInner(
    renderPass: GPURenderPassEncoder,
    node: any,
    buffersToDestroy: GPUBuffer[],
    inheritedOpacity: number,
    documentContext: DocumentContext,
  ): Promise<void> {
    const document = documentContext.document

    if (debugState.export.rendering) {
      debugState.export.errors.push(`Processing node ${node.layerId}`)
    }

    const layer = document.layers[node.layerId]
    if (!layer || !layer.visible) {
      // 統計に非表示レイヤーを記録
      if (debugState.export.rendering) {
        debugState.export.rendering.skippedObjects++
        debugState.export.errors.push(
          `Skipped layer ${node.layerId}: ${
            !layer ? 'not found' : 'not visible'
          }`,
        )
      }
      return
    }

    // 統計にレイヤー処理を記録
    if (debugState.export.rendering) {
      debugState.export.rendering.layersProcessed++
    }

    const layerOpacity = (layer.opacity || 1.0) * inheritedOpacity

    // グループレイヤーの場合は子レイヤーを処理
    if (layer.type === 'group') {
      const childNodes = document.layerNodes
        .filter((childNode: any) => childNode.parentId === layer.id)
        .sort((a: any, b: any) => a.order - b.order)

      for (const childNode of childNodes) {
        await this.renderDownLayerTreeInner(
          renderPass,
          childNode,
          buffersToDestroy,
          layerOpacity,
          documentContext,
        )
      }
    } else {
      // ベクターレイヤーの場合はPathArtObjectを描画
      if (layer.type === 'vector') {
        await this.renderDownDocumentVectorLayer(
          renderPass,
          layer,
          layerOpacity,
          buffersToDestroy,
          documentContext,
        )
      }
    }
  }

  private async renderDownDocumentVectorLayer(
    renderPass: GPURenderPassEncoder,
    layer: any,
    opacity: number,
    buffersToDestroy: GPUBuffer[],
    documentContext: DocumentContext,
  ): Promise<void> {
    const document = documentContext.document

    // artObjectIds内のArtObjectをレンダリング
    if (layer.artObjectIds && layer.artObjectIds.length > 0) {
      for (const artObjectId of layer.artObjectIds) {
        const artObject = document.artObjects[artObjectId]
        if (!artObject || !artObject.visible) {
          // 統計に非表示オブジェクトを記録
          if (debugState.export.rendering) {
            debugState.export.rendering.skippedObjects++
          }
          continue
        }

        // 統計にオブジェクト処理を記録
        if (debugState.export.rendering) {
          debugState.export.rendering.artObjectsProcessed++
        }

        try {
          // タイプ別にレンダリング
          if (artObject.type === 'path') {
            await this.renderPathArtObject(
              renderPass,
              artObject,
              opacity,
              buffersToDestroy,
            )
          } else if (artObject.type === 'canvas') {
            await this.renderCanvasArtObject(
              renderPass,
              artObject,
              opacity,
              buffersToDestroy,
            )
          }
        } catch (error) {
          // 統計にレンダリングエラーを記録
          if (debugState.export.rendering) {
            debugState.export.rendering.renderErrors.push({
              artObjectId,
              artObjectType: artObject.type,
              error: error instanceof Error ? error.message : String(error),
              timestamp: performance.now(),
            })
          }
          throw error
        }
      }
    }
  }

  /**
   * PathArtObjectをレンダリング
   */
  private async renderPathArtObject(
    renderPass: GPURenderPassEncoder,
    artObject: any,
    layerOpacity: number,
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    if (
      !artObject.path ||
      !artObject.path.points ||
      artObject.path.points.length < 2
    ) {
      // 統計に無効なパスを記録
      if (debugState.export.rendering) {
        debugState.export.rendering.skippedObjects++
      }
      return
    }

    // PathArtObjectのパスデータをVectorPathに変換
    const vectorPath: VectorPath = {
      points: artObject.path.points,
      closed: artObject.path.closed || false,
    }

    // 統計にパス処理を記録
    if (debugState.export.rendering) {
      debugState.export.rendering.pathsRendered++
      debugState.export.errors.push(`=== Rendering Path ${artObject.id} ===`)
      debugState.export.errors.push(`  Points: ${vectorPath.points.length}`)
      debugState.export.errors.push(
        `  Transform: ${
          artObject.transform
            ? `(${artObject.transform.x}, ${artObject.transform.y})`
            : 'none'
        }`,
      )
      debugState.export.errors.push(
        `  Appearances: ${artObject.appearances.length}`,
      )
    }

    // 各アピアランスを処理
    for (const appearance of artObject.appearances) {
      if (!appearance.enabled) continue

      try {
        if (isStrokeAppearance(appearance)) {
          // 統計にストローク処理を記録
          if (debugState.export.rendering) {
            debugState.export.rendering.strokesRendered++
          }

          if (this.strokeRenderer) {
            // エクスポート時はアルファ値を強制的に上げる
            const exportAppearance = {
              ...appearance,
              params: {
                ...appearance.params,
                opacity: Math.max(
                  appearance.params.opacity * layerOpacity,
                  0.5,
                ),
              },
            }

            // 一時ストロークと同じレンダリングパイプラインを使用
            try {
              await this.renderStrokePipeline(
                renderPass,
                vectorPath,
                exportAppearance,
                1.0, // layerOpacityは既にappearanceに適用済み
                buffersToDestroy,
                artObject.id,
              )

              // ストローク描画成功をログ
              if (debugState.export.rendering) {
                debugState.export.errors.push(
                  `Stroke rendered: ${artObject.id}`,
                )
              }
            } catch (error) {
              if (debugState.export.rendering) {
                debugState.export.errors.push(
                  `Stroke failed: ${artObject.id} - ${error}`,
                )
              }
            }
          }
        } else if (isFillAppearance(appearance) && this.fillRenderer) {
          // 統計に塗り処理を記録
          if (debugState.export.rendering) {
            debugState.export.rendering.fillsRendered++
          }

          // 論理ピクセルサイズを使用（一時ストロークと統一）
          // エクスポート時はターゲットテクスチャのサイズを使用
          const canvasSize = this.currentRenderTargetTexture
            ? {
                width: this.currentRenderTargetTexture.width,
                height: this.currentRenderTargetTexture.height,
              }
            : this.getLogicalCanvasSize()
          const { width: logicalWidth, height: logicalHeight } = canvasSize

          // エクスポート時はアルファ値を強制的に上げる
          const exportFillAppearance = {
            ...appearance,
            params: {
              ...appearance.params,
              opacity: Math.max(appearance.params.opacity * layerOpacity, 0.5),
            },
          }

          // 塗りアピアランスをレンダリング
          try {
            const { buffers } = await this.fillRenderer.render(
              renderPass,
              vectorPath,
              exportFillAppearance,
              this.camera.getProjectionMatrix(logicalWidth, logicalHeight),
              this.camera.getViewMatrix(logicalWidth, logicalHeight),
              { width: logicalWidth, height: logicalHeight },
              { x: 0, y: 0, width: 0, height: 0 },
            )
            // バッファを安全に追加（undefinedを除外）
            buffers.forEach((buffer) => {
              if (buffer) buffersToDestroy.push(buffer)
            })

            // フィル描画成功をログ
            if (debugState.export.rendering) {
              debugState.export.errors.push(`Fill rendered: ${artObject.id}`)
            }
          } catch (error) {
            if (debugState.export.rendering) {
              debugState.export.errors.push(
                `Fill failed: ${artObject.id} - ${error}`,
              )
            }
          }
        }
      } catch (error) {
        // 統計にアピアランス処理エラーを記録
        if (debugState.export.rendering) {
          debugState.export.rendering.renderErrors.push({
            artObjectId: artObject.id,
            artObjectType: artObject.type,
            appearanceType: appearance.type,
            error: error instanceof Error ? error.message : String(error),
            timestamp: performance.now(),
          })
        }
        throw error
      }
    }
  }

  /**
   * CanvasArtObjectをレンダリング
   */
  private async renderCanvasArtObject(
    renderPass: GPURenderPassEncoder,
    artObject: any,
    layerOpacity: number,
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    if (!isCanvasArtObject(artObject) || !this.canvasRenderer) {
      return
    }

    // 論理ピクセルサイズを使用
    const { width: logicalWidth, height: logicalHeight } =
      this.getLogicalCanvasSize()

    try {
      const { buffers } = await this.canvasRenderer.render(
        renderPass,
        artObject,
        this.camera.getProjectionMatrix(logicalWidth, logicalHeight),
        this.camera.getViewMatrix(logicalWidth, logicalHeight),
        { width: logicalWidth, height: logicalHeight },
        { x: 0, y: 0, width: 0, height: 0 },
      )
      // バッファを安全に追加（undefinedを除外）
      buffers.forEach((buffer) => {
        if (buffer) buffersToDestroy.push(buffer)
      })
    } catch (error) {}
  }

  async render(documentContext?: DocumentContext) {
    return this.renderRegion(documentContext)
  }

  /**
   * 特定の領域をレンダリング
   * @param documentContext ドキュメントコンテキスト
   * @param region レンダリング領域（未指定の場合は全領域）
   * @param targetTexture 出力先テクスチャ（未指定の場合はキャンバス）
   */
  async renderRegion(
    documentContext?: DocumentContext,
    region?: { x: number; y: number; width: number; height: number },
    targetTexture?: GPUTexture,
    cameraOverride?: { position: { x: number; y: number }; zoom: number },
  ) {
    if (!this.device || !this.context || !this.renderPipeline) {
      if (debugState.export.rendering) {
        debugState.export.errors.push(
          `FATAL: WebGPU not initialized: device=${!!this
            .device} context=${!!this.context} pipeline=${!!this
            .renderPipeline}`,
        )
      }
      return
    }

    // キャンバスサイズをチェック
    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height

    if (canvasWidth <= 0 || canvasHeight <= 0) {
      if (debugState.export.rendering) {
        debugState.export.errors.push(
          `FATAL: Invalid canvas size: ${canvasWidth}x${canvasHeight}`,
        )
      }
      console.error(`Invalid canvas size: ${canvasWidth}x${canvasHeight}`)
      debugState.ui.errorCount++
      debugState.ui.lastError = `Invalid canvas size: ${canvasWidth}x${canvasHeight}`
      return
    }

    // UIデバッグ情報をフレーム毎にリセット
    debugState.ui.renderOrder = []

    // documentContextが提供されていない場合は、state.documentから作成
    if (!documentContext) {
      documentContext = new DocumentContext(
        this.state.document,
        null as any, // ヒストリーは今回は無視
        {
          renderCache: new Map(),
          bufferCache: new Map(),
          geometryCache: new Map(),
          filterCache: new Map(),
          lastAccessed: new Date(),
        },
      )
    }

    const renderStartTime = performance.now()

    // デバッグキャプチャ開始
    this.startFrameCapture(documentContext)

    const now = performance.now()
    const deltaTime = now - this.lastFrameTime
    this.lastFrameTime = now
    this.frameCount++

    if (now - this.fpsUpdateTime >= 1000) {
      const fps = (this.frameCount * 1000) / (now - this.fpsUpdateTime)
      this.updatePerformanceMetrics(fps, deltaTime)
      this.frameCount = 0
      this.fpsUpdateTime = now
    }

    const commandEncoder = this.device.createCommandEncoder({
      label: 'VectorPaintRenderCommandEncoder',
    })

    // WebGPUコンテキストとテクスチャの状態をチェック
    if (!this.context) {
      console.error('WebGPU context is null')
      debugState.ui.errorCount++
      debugState.ui.lastError = 'WebGPU context is null'
      return
    }

    let canvasTexture: GPUTexture
    try {
      canvasTexture = this.context.getCurrentTexture()
    } catch (error) {
      console.error('Failed to get current texture from WebGPU context:', error)
      debugState.ui.errorCount++
      debugState.ui.lastError =
        'Failed to get current texture: ' +
        (error instanceof Error ? error.message : String(error))
      return
    }

    // テクスチャが有効かチェック
    if (!canvasTexture) {
      console.error('getCurrentTexture returned null')
      debugState.ui.errorCount++
      debugState.ui.lastError = 'getCurrentTexture returned null'
      return
    }

    // ターゲットテクスチャの決定
    const renderTexture = targetTexture || canvasTexture
    const renderTextureView = targetTexture
      ? targetTexture.createView({ label: 'CustomTargetTextureView' })
      : canvasTexture.createView({ label: 'VectorPaintCanvasTextureView' })

    // 現在のレンダーターゲットを保存
    this.currentRenderTargetTexture = targetTexture || null

    // 修正1テスト: テクスチャとビューの詳細をデバッグ
    if (targetTexture) {
      debugState.export.errors.push(
        `DEBUG-TOKEN-VWX789: Using targetTexture: ${targetTexture.width}x${targetTexture.height} format=${targetTexture.format}`,
      )
      debugState.export.errors.push(
        `DEBUG-TOKEN-VWX789: TargetTexture usage: ${targetTexture.usage} (should include RENDER_ATTACHMENT=${GPUTextureUsage.RENDER_ATTACHMENT})`,
      )
      debugState.export.errors.push(
        `DEBUG-TOKEN-VWX789: TextureView created: ${
          renderTextureView ? 'YES' : 'NO'
        }`,
      )
      debugState.export.errors.push(
        `DEBUG-TOKEN-VWX789: RenderTexture === TargetTexture: ${
          renderTexture === targetTexture ? 'YES' : 'NO'
        }`,
      )
    }

    // 背景色をデバッグ
    const bgColor = this.state.canvas.backgroundColor

    // エクスポート時は背景を透明にする
    const clearValue = targetTexture
      ? {
          r: 0.0,
          g: 0.0,
          b: 0.0,
          a: 0.0, // 完全に透明
        }
      : {
          r: bgColor.r,
          g: bgColor.g,
          b: bgColor.b,
          a: bgColor.a,
        }

    if (targetTexture) {
      debugState.export.errors.push(
        `DEBUG-TOKEN-MNO789: ClearValue set to: RGBA(${clearValue.r},${clearValue.g},${clearValue.b},${clearValue.a})`,
      )
    }

    const renderPass = commandEncoder.beginRenderPass({
      label: targetTexture
        ? 'VectorPaintOffscreenRenderPass'
        : 'VectorPaintMainRenderPass',
      colorAttachments: [
        {
          view: renderTextureView,
          clearValue,
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })

    // 修正1テスト: RenderPass作成直後のデバッグ
    if (targetTexture) {
      debugState.export.errors.push(
        `DEBUG-TOKEN-VWX789: RenderPass created: ${renderPass ? 'YES' : 'NO'}`,
      )
      debugState.export.errors.push(
        `DEBUG-TOKEN-VWX789: LoadOp='clear' with clearValue RGBA(${clearValue.r},${clearValue.g},${clearValue.b},${clearValue.a})`,
      )
      debugState.export.errors.push(
        `DEBUG-TOKEN-VWX789: StoreOp='store' - result should be saved to texture`,
      )
    }

    // 領域指定がある場合はビューポートとシザリング設定
    if (region) {
      // ターゲットテクスチャへのレンダリング時はDPRを適用しない
      const dpr = targetTexture ? 1 : window.devicePixelRatio || 1
      // オフスクリーンレンダリング時はビューポートを(0,0)から開始
      const x = targetTexture ? 0 : Math.floor(region.x * dpr)
      const y = targetTexture ? 0 : Math.floor(region.y * dpr)
      const width = Math.floor(region.width * dpr)
      const height = Math.floor(region.height * dpr)

      // WebGPUのビューポート座標系は左上原点、Y軸下向き
      renderPass.setViewport(x, y, width, height, 0.0, 1.0)

      // WebGPUでは明示的なシザーテストは存在しないため、ビューポートで制限
      // 必要に応じてシェーダー内でワールド座標の範囲チェックを行う

      if (targetTexture) {
        debugState.export.errors.push(
          `DEBUG-TOKEN-MNO789: Export Viewport set: (${x},${y}) ${width}x${height} (no DPR)`,
        )
        debugState.export.errors.push(
          `DEBUG-TOKEN-MNO789: Region input: (${region.x},${region.y}) ${region.width}x${region.height}`,
        )
        debugState.export.errors.push(
          `DEBUG-TOKEN-MNO789: Texture size: ${renderTexture.width}x${renderTexture.height}`,
        )

        // ビューポートがテクスチャサイズを超えていないかチェック
        const textureWidth = renderTexture.width
        const textureHeight = renderTexture.height
        if (x + width > textureWidth || y + height > textureHeight) {
          debugState.export.errors.push(
            `DEBUG-TOKEN-MNO789: ERROR - Viewport exceeds texture bounds! Texture: ${textureWidth}x${textureHeight}`,
          )
        }

        // ビューポートが0以下でないかチェック
        if (width <= 0 || height <= 0) {
          debugState.export.errors.push(
            `DEBUG-TOKEN-MNO789: ERROR - Invalid viewport size: ${width}x${height}`,
          )
        }
      } else {
        debugState.export.errors.push(
          `Viewport: ${x},${y} ${width}x${height} DPR:${dpr}`,
        )
      }
    }

    // バッファ管理変数を初期化
    const buffersToDestroy: GPUBuffer[] = []
    let pathsRendered = 0

    // 描画順序リセット
    debugState.ui.drawOrder = []
    debugState.ui.renderCalls = []

    // 1. 背景UIコンポーネントを先に描画（アートボード境界など）
    // エクスポート時はUIコンポーネントをスキップ
    if (!targetTexture) {
      debugState.ui.drawOrder.push({
        type: 'ui-background',
        timestamp: performance.now(),
      })
      try {
        await this.renderUIComponentsBackground(
          renderPass,
          documentContext,
          buffersToDestroy,
        )
      } catch (error) {
        console.error('Error rendering background UI components:', error)
        debugState.ui.errorCount++
        debugState.ui.lastError =
          error instanceof Error ? error.message : String(error)
      }
    }

    try {
      const document = documentContext.document

      // ドキュメント状態をデバッグ情報に更新
      debugState.stroke.document.layerCount = Object.keys(
        document.layers,
      ).length
      debugState.stroke.document.artObjectCount = Object.keys(
        document.artObjects,
      ).length
      debugState.stroke.document.lastDocumentId = document.id

      // 詳細統計の計算
      let visibleLayerCount = 0
      let strokeLayerCount = 0
      let strokeArtObjectCount = 0

      Object.values(document.layers).forEach((layer) => {
        if (layer.visible) visibleLayerCount++
        if (layer.type === 'vector') {
          strokeLayerCount++
          const vectorLayer = layer as any
          if (vectorLayer.artObjectIds) {
            vectorLayer.artObjectIds.forEach((artObjectId: string) => {
              const artObject = document.artObjects[artObjectId]
              if (artObject?.type === 'path') {
                strokeArtObjectCount++
              }
            })
          }
        }
      })

      debugState.stroke.document.visibleLayerCount = visibleLayerCount
      debugState.stroke.document.strokeLayerCount = strokeLayerCount
      debugState.stroke.document.strokeArtObjectCount = strokeArtObjectCount

      // エクスポート時のレンダリング統計をリセット
      if (targetTexture) {
        debugState.export.rendering.layersProcessed = 0
        debugState.export.rendering.artObjectsProcessed = 0
        debugState.export.rendering.visibleLayers = visibleLayerCount
        debugState.export.rendering.pathsRendered = 0
        debugState.export.rendering.fillsRendered = 0
        debugState.export.rendering.strokesRendered = 0
        debugState.export.rendering.skippedObjects = 0
        debugState.export.rendering.renderErrors = []
      }

      // 2. アートオブジェクト・レイヤーを描画
      if (targetTexture && debugState.export.rendering) {
        debugState.export.errors.push('Starting renderDownLayerTree')
      }

      debugState.ui.drawOrder.push({
        type: 'artobjects',
        timestamp: performance.now(),
      })
      await this.renderDownLayerTree(
        renderPass,
        buffersToDestroy,
        documentContext,
      )

      if (targetTexture && debugState.export.rendering) {
        debugState.export.errors.push('Finished renderDownLayerTree')
      }
    } catch (error) {
      console.error('renderDownLayerTree error:', error)
      debugState.stroke.rendering.lastError =
        error instanceof Error ? error.message : String(error)
      debugState.stroke.rendering.lastErrorStack =
        error instanceof Error ? error.stack || null : null
      debugState.stroke.rendering.lastErrorLocation = 'renderDownLayerTree'
      debugState.stroke.rendering.failureCount++
    }

    // 3. 現在描画中のストロークを描画（リアルタイムプレビュー）
    // エクスポート時はプレビューストロークをスキップ
    if (
      !targetTexture &&
      this.strokeRenderer &&
      this.state.tools.currentStroke &&
      this.state.tools.currentStroke.points.length >= 2
    ) {
      try {
        await this.renderPreviewStroke(
          renderPass,
          this.state.tools.currentStroke,
          buffersToDestroy,
          documentContext,
        )
        pathsRendered++
      } catch (error) {
        console.error('Error rendering preview stroke:', error)
        debugState.ui.errorCount++
        debugState.ui.lastError =
          error instanceof Error ? error.message : String(error)
      }
    }

    // 4. 前景UIコンポーネントを描画（選択ハンドルなど）
    // エクスポート時はUIコンポーネントをスキップ
    if (!targetTexture) {
      debugState.ui.drawOrder.push({
        type: 'ui-foreground',
        timestamp: performance.now(),
      })
      try {
        await this.renderUIComponentsForeground(
          renderPass,
          documentContext,
          buffersToDestroy,
        )
      } catch (error) {
        console.error('Error rendering foreground UI components:', error)
        debugState.ui.errorCount++
        debugState.ui.lastError =
          error instanceof Error ? error.message : String(error)
      }
    }

    // 5. レガシーUIレンダリング（スクリーンUI要素など）
    // エクスポート時はUIレンダリングをスキップ
    if (!targetTexture && this.uiManager) {
      debugState.ui.drawOrder.push({
        type: 'ui-legacy',
        timestamp: performance.now(),
      })
      const canvasSize = this.getLogicalCanvasSize()
      const uiBuffers = await this.uiManager.renderUI(
        renderPass,
        documentContext,
        this.camera,
        canvasSize,
        this,
      )
      buffersToDestroy.push(...uiBuffers)
    }

    renderPass.end()

    if (targetTexture) {
      debugState.export.errors.push(
        `DEBUG-TOKEN-MNO789: RenderPass ended for offscreen texture`,
      )

      // 修正1テスト: renderPass.end()直後にテクスチャサンプリングをcommandEncoderに追加
      debugState.export.errors.push(
        `DEBUG-TOKEN-VWX789: Adding texture sampling to same command buffer`,
      )

      const immediateTestBuffer = this.device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      commandEncoder.copyTextureToBuffer(
        {
          texture: targetTexture,
          origin: {
            x: Math.floor(targetTexture.width / 2),
            y: Math.floor(targetTexture.height / 2),
            z: 0,
          },
        },
        { buffer: immediateTestBuffer, bytesPerRow: 256 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      )

      // コマンドバッファー送信後にサンプリング結果を確認
      const commandBuffer = commandEncoder.finish()
      this.device.queue.submit([commandBuffer])

      this.device.queue.onSubmittedWorkDone().then(async () => {
        await immediateTestBuffer.mapAsync(GPUMapMode.READ)
        const immediateTestData = new Uint8Array(
          immediateTestBuffer.getMappedRange(),
        )

        const immediatePixel = {
          r: immediateTestData[0],
          g: immediateTestData[1],
          b: immediateTestData[2],
          a: immediateTestData[3],
        }
        debugState.export.errors.push(
          `DEBUG-TOKEN-VWX789: IMMEDIATE after renderPass.end(): RGBA(${immediatePixel.r},${immediatePixel.g},${immediatePixel.b},${immediatePixel.a})`,
        )

        immediateTestBuffer.unmap()
        immediateTestBuffer.destroy()
      })
    } else {
      // targetTextureがない場合は通常の処理
      // コマンドをfinishする前にテクスチャが有効か再確認
      try {
        // テクスチャが破棄されていないか最終チェック
        if (!targetTexture && canvasTexture.label !== undefined) {
          // canvasTextureが有効であることを確認
        }

        const commandBuffer = commandEncoder.finish()
        this.device.queue.submit([commandBuffer])
      } catch (error) {
        console.error('Error submitting WebGPU commands:', error)
        debugState.ui.errorCount++
        debugState.ui.lastError =
          error instanceof Error ? error.message : String(error)

        // 破棄されたテクスチャエラーの場合、特別なハンドリング
        if (
          error instanceof Error &&
          error.message.includes('Destroyed texture')
        ) {
          console.warn('Destroyed texture detected, skipping this frame')
          return
        }
      }
    }

    // 全ての描画コマンドがキューに送信された後でバッファを破棄
    buffersToDestroy.forEach((buffer) => {
      if (buffer && typeof buffer.destroy === 'function') {
        try {
          buffer.destroy()
        } catch (error) {
          console.warn('Error destroying buffer:', error)
        }
      }
    })

    const renderEndTime = performance.now()
    const renderDuration = renderEndTime - renderStartTime

    // レンダリング情報を記録
    this.recordRenderPass(
      'MainRenderPass',
      renderDuration,
      pathsRendered * 6, // 概算頂点数
      pathsRendered * 2, // 概算三角形数
      pathsRendered,
    )

    // デバッグキャプチャ完了
    this.finishFrameCapture()

    // デバッグ情報
    if (pathsRendered === 0) {
    }

    // レンダーターゲットをクリア
    this.currentRenderTargetTexture = null
  }

  resize(width: number, height: number) {
    if (!this.canvas) return

    const dpr = window.devicePixelRatio || 1
    this.canvas.width = width * dpr
    this.canvas.height = height * dpr
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`

    this.state.viewport.width = width
    this.state.viewport.height = height
  }

  screenToWorld(screenX: number, screenY: number): Vector2 {
    const rect = this.canvas.getBoundingClientRect()

    // 簡単な座標変換（-1.0 to 1.0の正規化座標系）
    const x = (screenX / rect.width) * 2 - 1
    const y = -((screenY / rect.height) * 2 - 1)

    return { x, y }
  }

  worldToScreen(worldX: number, worldY: number): Vector2 {
    const { viewport } = this.state
    return {
      x: (worldX - viewport.x) * viewport.zoom,
      y: (worldY - viewport.y) * viewport.zoom,
    }
  }

  /**
   * カメラの状態を更新
   */
  updateCamera(x: number, y: number, zoom: number, rotation: number): void {
    this.camera.setPosition(x, y)
    this.camera.setZoom(zoom)
    this.camera.setRotation(rotation)

    // エンジンステートも同期更新
    this.state.viewport.x = x
    this.state.viewport.y = y
    this.state.viewport.zoom = zoom
    this.state.viewport.rotation = rotation
  }

  /**
   * カメラオブジェクトを取得
   */
  getCamera(): Camera2D {
    return this.camera
  }

  /**
   * WebGPUデバイスとコンテキストを設定
   */
  private setWebGPUDevice(device: GPUDevice, context: GPUCanvasContext): void {
    this.state.performance.webgpuDevice = device
    this.state.performance.webgpuContext = context
  }

  /**
   * パフォーマンスメトリクスを更新
   */
  private updatePerformanceMetrics(fps: number, frameTime: number): void {
    this.state.performance.fps = fps
    this.state.performance.frameTime = frameTime
  }

  /**
   * 描画開始
   */
  startDrawing(path: VectorPath): void {
    this.state.tools.isDrawing = true
    this.state.tools.currentStroke = path
    // 一時ストローク用の決定的なIDを生成
    this.currentTempStrokeId = this.generateTempStrokeId(path)
  }

  /**
   * 描画終了
   */
  endDrawing(document: any): void {
    this.state.tools.isDrawing = false
    this.state.tools.currentStroke = null
    this.currentTempStrokeId = null
  }

  /**
   * 現在のストロークにポイントを追加
   */
  addPointToCurrentStroke(point: Vector2): void {
    if (this.state.tools.currentStroke) {
      this.state.tools.currentStroke.points.push(point)
    }
  }

  /**
   * ブラシ設定を更新
   */
  setBrushConfig(config: any): void {
    Object.assign(this.state.strokeSettings, config)
  }

  /**
   * アクティブツールを設定
   */
  setActiveTool(tool: any): void {
    this.state.tools.activeTool = tool
  }

  /**
   * リソースを解放
   */
  destroy(): void {
    this.layerCompositor?.destroy()
    this.offscreenTexturePool?.destroy()
    this.fillRenderer?.dispose()
    this.strokeRenderer?.destroy()
    this.canvasRenderer?.dispose()
    this.uniformBuffer?.destroy()

    // UIコンポーネントマネージャーを破棄
    this.uiComponentManager?.destroy()

    this.layerCompositor = null
    this.offscreenTexturePool = null
    this.fillRenderer = null
    this.strokeRenderer = null
    this.canvasRenderer = null
    this.uniformBuffer = null
    this.bindGroup = null
    this.renderPipeline = null
    this.lineRenderPipeline = null
    this.simpleFillPipeline = null
  }

  /**
   * 論理ピクセルサイズを取得（座標系統一用）
   */
  getLogicalCanvasSize(): { width: number; height: number } {
    const logicalWidth = this.canvas.style.width
      ? parseInt(this.canvas.style.width)
      : this.canvas.width
    const logicalHeight = this.canvas.style.height
      ? parseInt(this.canvas.style.height)
      : this.canvas.height
    return { width: logicalWidth, height: logicalHeight }
  }

  /**
   * 統一されたストロークレンダリングパイプライン
   * 一時ストロークと永続ストロークの両方で使用
   */
  private async renderStrokePipeline(
    renderPass: GPURenderPassEncoder,
    vectorPath: VectorPath,
    appearance: Appearance,
    layerOpacity: number,
    buffersToDestroy: GPUBuffer[],
    artObjectId: string,
  ): Promise<void> {
    if (!this.strokeRenderer) return
    if (!isStrokeAppearance(appearance)) {
      console.warn('Invalid appearance for stroke rendering:', appearance)
      return
    }

    // 論理ピクセルサイズを使用（統一）
    // エクスポート時はターゲットテクスチャのサイズを使用
    const canvasSize = this.currentRenderTargetTexture
      ? {
          width: this.currentRenderTargetTexture.width,
          height: this.currentRenderTargetTexture.height,
        }
      : this.getLogicalCanvasSize()
    const { width: logicalWidth, height: logicalHeight } = canvasSize

    // ブラシ設定を取得（保存されたものがあればそれを使用、なければ現在の設定）
    const brushSettings =
      appearance.params.brushSettings || this.state.strokeSettings.brushSettings

    const renderStartTime = performance.now()

    // レンダリング呼び出し情報を更新
    debugState.stroke.rendering.callCount++
    debugState.stroke.rendering.lastCallTime = renderStartTime
    debugState.stroke.rendering.lastPathPointCount = vectorPath.points.length
    debugState.stroke.rendering.lastArtObjectId = artObjectId

    try {
      const { buffers } = await this.strokeRenderer.render(
        renderPass,
        vectorPath,
        {
          ...appearance,
          params: {
            ...appearance.params,
            opacity: appearance.params.opacity * layerOpacity,
          },
        },
        this.camera.getProjectionMatrix(logicalWidth, logicalHeight),
        this.camera.getViewMatrix(logicalWidth, logicalHeight),
        { width: logicalWidth, height: logicalHeight },
        { x: 0, y: 0, width: 0, height: 0 },
        artObjectId,
        brushSettings,
      )

      debugState.stroke.rendering.renderDuration =
        performance.now() - renderStartTime
      debugState.stroke.rendering.lastError = null
      debugState.stroke.rendering.lastErrorStack = null
      debugState.stroke.rendering.lastErrorLocation = null
      debugState.stroke.rendering.lastSuccessTime = performance.now()
      debugState.stroke.rendering.successCount++

      // バッファを安全に追加（undefinedを除外）
      buffers.forEach((buffer) => {
        if (buffer) buffersToDestroy.push(buffer)
      })
    } catch (error) {
      debugState.stroke.rendering.lastError =
        error instanceof Error ? error.message : String(error)
      debugState.stroke.rendering.lastErrorStack =
        error instanceof Error ? error.stack || null : null
      debugState.stroke.rendering.lastErrorLocation = 'renderStrokePipeline'
      debugState.stroke.rendering.failureCount++
      throw error
    }
  }

  /**
   * 一時ストローク専用のレンダリングメソッド（統一パイプラインを使用）
   */
  private async renderPreviewStroke(
    renderPass: GPURenderPassEncoder,
    currentStroke: VectorPath,
    buffersToDestroy: GPUBuffer[],
    documentContext: DocumentContext,
  ): Promise<void> {
    if (!this.strokeRenderer) return

    // アクティブレイヤーの不透明度を取得
    let layerOpacity = 1.0
    const document = documentContext.document
    if (document?.activeLayerId) {
      const activeLayer = document.layers[document.activeLayerId]
      if (activeLayer) {
        layerOpacity = activeLayer.opacity || 1.0
      }
    }

    // 一時ストローク用のStrokeAppearanceを生成
    const { createStrokeAppearance: createStroke } = await import(
      '../document/appearance'
    )
    const strokeAppearance = createStroke({
      width: this.state.strokeSettings.width,
      color: this.state.strokeSettings.color,
      style: 'solid',
      lineCap: 'round',
      lineJoin: 'round',
      opacity: 1.0, // 基本不透明度
      blendMode: 'normal',
      brushSettings: this.state.strokeSettings.brushSettings,
    })

    // 一時ストローク用の決定的なIDを使用（永続化時と同じIDにするため）
    const tempStrokeId =
      this.currentTempStrokeId || this.generateTempStrokeId(currentStroke)

    await this.renderStrokePipeline(
      renderPass,
      currentStroke,
      strokeAppearance,
      layerOpacity,
      buffersToDestroy,
      tempStrokeId,
    )
  }

  /** マウスイベントを処理してUIとの相互作用を管理 */
  private handleMouseEvent(
    clientX: number,
    clientY: number,
    eventType: 'click' | 'move',
  ): boolean {
    if (!this.uiManager || !this.canvas) return false

    // キャンバス相対座標に変換
    const rect = this.canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    // UIManagerに委譲
    const handled = this.uiManager.handleMouseEvent(x, y, eventType)

    if (handled && eventType === 'click') {
    }

    return handled
  }

  /** UIManagerを取得（外部からのアクセス用） */
  getUIManager(): UIManager | null {
    return this.uiManager
  }

  /** UIComponentManagerを取得（外部からのアクセス用） */
  getUIComponentManager(): UIComponentManager | null {
    return this.uiComponentManager
  }

  /** マウスイベントリスナーを設定 */
  private setupMouseEventListeners(): void {
    if (!this.canvas) return

    // マウス移動イベント
    this.canvas.addEventListener('mousemove', (event) => {
      this.handleMouseEvent(event.clientX, event.clientY, 'move')
    })

    // マウスクリックイベント
    this.canvas.addEventListener('click', (event) => {
      const handled = this.handleMouseEvent(
        event.clientX,
        event.clientY,
        'click',
      )
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
      }
    })
  }

  /**
   * 一時ストローク用の決定的なIDを生成
   * 最初のポイントの座標と現在時刻をベースにハッシュを作成
   */
  private generateTempStrokeId(path: VectorPath): string {
    if (path.points.length === 0) {
      return `temp-stroke-${Date.now()}`
    }

    const firstPoint = path.points[0]
    // 座標を整数化して一意性を保つ
    const x = Math.floor(firstPoint.x * 1000)
    const y = Math.floor(firstPoint.y * 1000)
    // timestampは現在のストロークが始まった時点の時刻を使用
    const timestamp = Date.now()

    return `temp-stroke-${x}-${y}-${timestamp}`
  }

  /**
   * 一時ストロークIDを取得（外部からのアクセス用）
   */
  getCurrentTempStrokeId(): string | null {
    return this.currentTempStrokeId
  }

  /** デバッグ情報のキャプチャを開始 */
  captureFrame() {
    debugState.isCapturing = true
  }

  /** デバッグ情報のキャプチャを開始（内部用） */
  private startFrameCapture(documentContext: DocumentContext): void {
    if (!debugState.isCapturing) return

    this.frameNumber++
    this.currentRenderDebugInfo = {
      frameNumber: this.frameNumber,
      timestamp: performance.now(),
      renderPasses: [],
      totalRenderTime: 0,
      memoryUsage: {
        buffers: 0,
        textures: 0,
        totalBytes: 0,
      },
      layerInfo: [],
      renderedObjects: [],
      cameraState: {
        zoom: this.state.viewport.zoom,
        position: { x: this.state.viewport.x, y: this.state.viewport.y },
        rotation: this.state.viewport.rotation,
      },
      webgpuStats: this.adapter
        ? {
            deviceLimits: this.device?.limits,
            adapterInfo: this.adapter.info || {},
            features: Array.from(this.device?.features || []),
          }
        : null,
    }

    // ドキュメントのレイヤー情報を収集
    const document = documentContext.document
    Object.values(document.layers).forEach((layer) => {
      const layerInfo = {
        layerId: layer.id,
        layerName: layer.name,
        artObjectCount: 0,
        appearanceCount: 0,
        triangles: 0,
      }

      if (layer.type === 'vector') {
        layerInfo.artObjectCount = layer.artObjectIds.length
        // 各アートオブジェクトの詳細情報を集計
        layer.artObjectIds.forEach((artObjectId) => {
          const artObject = document.artObjects[artObjectId]
          if (artObject?.type === 'path') {
            layerInfo.appearanceCount += artObject.appearances.length
            // 三角形数の概算（パスの複雑さに基づく）
            const triangles = Math.max(artObject.path.points.length - 2, 0) * 2
            layerInfo.triangles += triangles

            // レンダリングされたオブジェクトの詳細情報を収集
            const renderedObject = {
              artObjectId: artObject.id,
              artObjectName: artObject.name,
              layerId: layer.id,
              layerName: layer.name,
              type: artObject.type as 'path' | 'group',
              pathPointCount: artObject.path.points.length,
              appearances: artObject.appearances.map((appearance) => ({
                type:
                  appearance.effectId === 'fill'
                    ? ('fill' as const)
                    : appearance.effectId === 'stroke'
                    ? ('stroke' as const)
                    : ('fill' as const),
                id: appearance.uid,
                color:
                  appearance.effectId === 'fill'
                    ? appearance.params.color
                    : appearance.effectId === 'stroke'
                    ? appearance.params.color
                    : undefined,
                strokeWidth:
                  appearance.effectId === 'stroke'
                    ? appearance.params.width
                    : undefined,
                fillRule:
                  appearance.effectId === 'fill'
                    ? appearance.params.fillType
                    : undefined,
                enabled: appearance.enabled,
              })),
              renderStats: {
                triangles,
                vertices: artObject.path.points.length,
                renderTime: 0, // 実際のレンダリング時間は後で設定
              },
            }
            this.currentRenderDebugInfo!.renderedObjects.push(renderedObject)
          }
        })
      }

      this.currentRenderDebugInfo!.layerInfo.push(layerInfo)
    })
  }

  /** レンダーパス情報を記録 */
  private recordRenderPass(
    name: string,
    duration: number,
    vertexCount: number = 0,
    triangleCount: number = 0,
    drawCalls: number = 1,
  ): void {
    if (!this.currentRenderDebugInfo) return

    this.currentRenderDebugInfo.renderPasses.push({
      name,
      duration,
      vertexCount,
      triangleCount,
      drawCalls,
    })
  }

  /** デバッグ情報のキャプチャを完了 */
  private finishFrameCapture(): void {
    if (!this.currentRenderDebugInfo || !debugState.isCapturing) return

    // 総レンダリング時間を計算
    this.currentRenderDebugInfo.totalRenderTime =
      this.currentRenderDebugInfo.renderPasses.reduce(
        (total, pass) => total + pass.duration,
        0,
      )

    // メモリ使用量の概算（実際のWebGPU APIでは正確な値は取得困難）
    this.currentRenderDebugInfo.memoryUsage = {
      buffers: this.currentRenderDebugInfo.renderPasses.length * 2, // 概算
      textures: this.currentRenderDebugInfo.layerInfo.length + 1, // レイヤー数 + キャンバス
      totalBytes: this.currentRenderDebugInfo.layerInfo.reduce(
        (total, layer) => {
          return total + layer.triangles * 6 * 4 // 三角形あたり6頂点 * 4バイト
        },
        0,
      ),
    }

    // キャプチャした情報をstateに保存
    debugState.capturedFrame = this.currentRenderDebugInfo
    debugState.isCapturing = false

    this.currentRenderDebugInfo = null
  }

  /**
   * WebGPU UIコンポーネントを宣言的に初期化
   */
  private initializeUIComponents(): void {
    if (
      !this.device ||
      !this.lineRenderPipeline ||
      !this.simpleFillPipeline ||
      !this.textRenderPipeline
    )
      return

    // 宣言的UIアプローチ
    const uiDeclaration: WebGPUIDeclaration = {
      artboards: {
        background: true,
        foreground: true,
        showLabels: true,
        showBounds: true,
      },
      selection: {
        enabled: true,
        showHandles: true,
      },
      screenUI: {
        coordinateGrid: false,
        rulers: false,
      },
    }

    const context: WebGPUComponentContext = {
      device: this.device,
      pipelines: {
        line: this.lineRenderPipeline,
        fill: this.simpleFillPipeline,
        text: this.textRenderPipeline,
      },
      state: this.state,
    }

    // UIManagerを通じて宣言的にコンポーネントを生成
    if (this.uiManager) {
      const components = this.uiManager.createWebGPUComponents(
        uiDeclaration,
        context,
      )
      components.forEach((component) => {
        this.uiComponentManager?.addComponent(component)
      })
    }
  }

  /**
   * 選択システムの初期化
   */
  private setupSelectionSystem(): void {
    // ドキュメントアクセス関数を選択システムに注入
    setDocumentAccessFunction(() => this.state.document)
  }

  /**
   * WebGPU UIコンポーネントを描画（背景レイヤー）
   */
  private async renderUIComponentsBackground(
    renderPass: GPURenderPassEncoder,
    documentContext: DocumentContext,
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    const startTime = performance.now()
    debugState.ui.renderOrder.push('background')

    // 背景レイヤーのUIコンポーネント（アートボード境界など）を描画
    const canvasSize = this.getLogicalCanvasSize()

    if (!this.uiComponentManager) {
      debugState.ui.errorCount++
      debugState.ui.lastError = 'UIComponentManager is null for background UI'
      return
    }

    try {
      await this.uiComponentManager.renderAll(
        renderPass,
        documentContext,
        this.camera,
        canvasSize,
        buffersToDestroy,
      )

      const duration = performance.now() - startTime
      debugState.ui.renderPasses.background.count++
      debugState.ui.renderPasses.background.duration += duration
      debugState.ui.lastRenderTime = duration
    } catch (error) {
      debugState.ui.errorCount++
      debugState.ui.lastError =
        error instanceof Error ? error.message : String(error)
      console.error('Background UI render error:', error)
    }
  }

  /**
   * WebGPU UIコンポーネントを描画（前景レイヤー）
   */
  private async renderUIComponentsForeground(
    renderPass: GPURenderPassEncoder,
    documentContext: DocumentContext,
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    // 選択ハンドルなどの前景UIコンポーネントは、現在は背景と同じパスで描画される
    // 将来的には選択状態に応じた前景UI要素を追加する予定
  }

  /**
   * WebGPU UIコンポーネントを描画（レガシー互換性）
   */
  private async renderUIComponents(
    renderPass: GPURenderPassEncoder,
    documentContext: DocumentContext,
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    // UIComponentManagerを使用して全コンポーネントを描画（ArtObjectと同じcanvasSizeを使用）
    const canvasSize = this.getLogicalCanvasSize()

    if (!this.uiComponentManager) {
      console.error('UIComponentManager is null!')
      return
    }

    await this.uiComponentManager.renderAll(
      renderPass,
      documentContext,
      this.camera,
      canvasSize,
      buffersToDestroy,
    )
  }

  /**
   * スクリーン座標でのヒットテストを実行（レガシーサポート）
   */
  hitTest(
    screenX: number,
    screenY: number,
    documentContext: DocumentContext,
  ): HitTestResult[] {
    const canvasSize = this.getLogicalCanvasSize()
    const results = HitTester.hitTest(
      screenX,
      screenY,
      documentContext.document,
      this.camera,
      canvasSize,
    )

    // デバッグ情報に記録
    debugState.hitTest.lastHitPosition = { x: screenX, y: screenY }
    debugState.hitTest.lastHitResults = results.map((hit) => ({
      artObjectId: hit.artObject.id,
      artObjectName: hit.artObject.name,
      layerId: hit.layerId,
      layerName:
        documentContext.document.layers[hit.layerId]?.name || 'Unknown Layer',
      distance: hit.distance,
      worldPosition: hit.worldPosition,
      localPosition: hit.localPosition,
    }))
    debugState.hitTest.hitCount++

    return results
  }

  /**
   * UIComponentManagerを使用したレイキャストヒットテスト
   */
  raycast(screenX: number, screenY: number, documentContext: DocumentContext) {
    const canvasSize = this.getLogicalCanvasSize()
    const raycastHits = this.uiComponentManager?.raycast(
      screenX,
      screenY,
      documentContext,
      this.camera,
      canvasSize,
    )

    // UIManagerに結果を通知（選択UI更新のため）
    if (this.uiManager && raycastHits) {
      this.uiManager.updateSelectionFromHitTest(raycastHits)
    }

    return raycastHits || []
  }

  /**
   * 最も近いオブジェクトを取得
   */
  getClosestHit(
    screenX: number,
    screenY: number,
    documentContext: DocumentContext,
  ): HitTestResult | null {
    const hits = this.hitTest(screenX, screenY, documentContext)
    return HitTester.getClosestHit(hits)
  }

  /**
   * レンダリング用のカスタムテクスチャを作成
   * @param width テクスチャの幅
   * @param height テクスチャの高さ
   * @param format テクスチャフォーマット（デフォルト：rgba8unorm）
   * @returns 作成されたGPUTexture
   */
  createRenderTexture(
    width: number,
    height: number,
    format: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat(),
  ): GPUTexture | null {
    if (!this.device) {
      console.error('WebGPU device is not available')
      return null
    }

    if (width <= 0 || height <= 0) {
      console.error(`Invalid texture size: ${width}x${height}`)
      return null
    }

    try {
      return this.device.createTexture({
        label: `CustomRenderTexture-${width}x${height}`,
        size: { width, height },
        format,
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.COPY_SRC |
          GPUTextureUsage.TEXTURE_BINDING,
      })
    } catch (error) {
      console.error('Failed to create render texture:', error)
      return null
    }
  }

  /**
   * テクスチャからImageDataを取得
   * @param texture 読み込み元テクスチャ
   * @returns ImageDataまたはnull
   */
  async readTextureAsImageData(texture: GPUTexture): Promise<ImageData | null> {
    if (!this.device) {
      console.error('WebGPU device is not available')
      return null
    }

    try {
      const width = texture.width
      const height = texture.height
      const bytesPerPixel = 4 // RGBA

      // テクスチャ情報をdebugStateに記録
      debugState.export.texture.width = width
      debugState.export.texture.height = height
      debugState.export.texture.format = texture.format
      debugState.export.texture.readStartTime = performance.now()

      // バッファサイズを256バイト境界にアラインメント
      const bytesPerRow = Math.ceil((width * bytesPerPixel) / 256) * 256
      const bufferSize = bytesPerRow * height

      // バッファを作成してテクスチャからコピー
      const buffer = this.device.createBuffer({
        label: 'TextureReadBuffer',
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      // コマンドエンコーダーを作成する前にキューの処理を完了させる
      await this.device.queue.onSubmittedWorkDone()

      const commandEncoder = this.device.createCommandEncoder({
        label: 'TextureReadCommandEncoder',
      })

      commandEncoder.copyTextureToBuffer(
        {
          texture,
          mipLevel: 0,
          origin: { x: 0, y: 0, z: 0 },
        },
        {
          buffer,
          bytesPerRow,
          rowsPerImage: height,
        },
        { width, height, depthOrArrayLayers: 1 },
      )

      const commandBuffer = commandEncoder.finish()
      this.device.queue.submit([commandBuffer])

      // 提出されたワークの完了を待つ
      await this.device.queue.onSubmittedWorkDone()

      // バッファをマップして読み込み
      await buffer.mapAsync(GPUMapMode.READ)
      const mappedData = new Uint8Array(buffer.getMappedRange())

      // パディングを考慮してImageDataを作成
      const imageDataArray = new Uint8ClampedArray(width * height * 4)

      // テクスチャフォーマットがBGRAの場合、RGBAに変換
      const isBGRA = texture.format.includes('bgra')

      for (let row = 0; row < height; row++) {
        const srcOffset = row * bytesPerRow
        const dstOffset = row * width * 4

        if (isBGRA) {
          // BGRAからRGBAに変換
          for (let col = 0; col < width; col++) {
            const pixelSrcOffset = srcOffset + col * 4
            const pixelDstOffset = dstOffset + col * 4
            // B,G,R,A -> R,G,B,A
            imageDataArray[pixelDstOffset + 0] = mappedData[pixelSrcOffset + 2] // R <- B
            imageDataArray[pixelDstOffset + 1] = mappedData[pixelSrcOffset + 1] // G <- G
            imageDataArray[pixelDstOffset + 2] = mappedData[pixelSrcOffset + 0] // B <- R
            imageDataArray[pixelDstOffset + 3] = mappedData[pixelSrcOffset + 3] // A <- A
          }
        } else {
          // RGBAの場合はそのままコピー
          const rowData = mappedData.subarray(srcOffset, srcOffset + width * 4)
          imageDataArray.set(rowData, dstOffset)
        }
      }

      const imageData = new ImageData(imageDataArray, width, height)

      buffer.unmap()
      buffer.destroy()

      // debugStateにImageData情報を記録
      debugState.export.texture.readEndTime = performance.now()
      debugState.export.texture.bytesRead = bufferSize
      debugState.export.imageData.width = width
      debugState.export.imageData.height = height

      return imageData
    } catch (error) {
      console.error('Failed to read texture as ImageData:', error)
      return null
    }
  }

  /**
   * 効率的な部分レンダリング（オフスクリーンテクスチャ使用）
   * @param region ワールド座標での領域
   * @param outputWidth 出力テクスチャの幅（デフォルト：region.width）
   * @param outputHeight 出力テクスチャの高さ（デフォルト：region.height）
   * @returns レンダリング結果テクスチャ
   */
  async renderRegionToTexture(
    region: { x: number; y: number; width: number; height: number },
    outputWidth?: number,
    outputHeight?: number,
    providedDocumentContext?: DocumentContext,
  ): Promise<GPUTexture | null> {
    // 無限再帰防止チェック
    const callKey = `${region.x},${region.y},${region.width},${region.height}`
    if (!this.renderCallCount) this.renderCallCount = new Map()
    const currentCount = this.renderCallCount.get(callKey) || 0
    if (currentCount > 5) {
      debugState.export.errors.push(
        `Prevented infinite recursion for region ${callKey}`,
      )
      return null
    }
    this.renderCallCount.set(callKey, currentCount + 1)

    // documentContextが提供されている場合はそれを使用、なければ新規作成
    const documentContext =
      providedDocumentContext ||
      new DocumentContext(
        this.state.document,
        null as any, // ヒストリーは今回は無視
        {
          renderCache: new Map(),
          bufferCache: new Map(),
          geometryCache: new Map(),
          filterCache: new Map(),
          lastAccessed: new Date(),
        },
      )

    // 提供されたdocumentContextを使用している場合のデバッグ
    if (providedDocumentContext) {
      debugState.export.errors.push('Using provided documentContext')
    } else {
      debugState.export.errors.push(
        'Creating new documentContext from state.document',
      )
    }

    // layerNodesが存在するか確認
    if (documentContext.document.layerNodes) {
      console.log(
        '[PNG Export Debug] document.layerNodes:',
        documentContext.document.layerNodes,
      )
      if (documentContext.document.layerNodes.length === 0) {
        console.error('[PNG Export Debug] layerNodes is empty!')
        debugState.export.errors.push('FATAL: layerNodes is empty in document')
      }
    } else {
      console.error('[PNG Export Debug] No layerNodes property in document!')
      debugState.export.errors.push('FATAL: No layerNodes property in document')
    }

    if (!documentContext.document) {
      debugState.export.errors.push(
        'FATAL: No active document for region rendering',
      )
      console.warn('No active document for region rendering')
      return null
    }

    debugState.export.errors.push(
      `Document loaded: ${documentContext.document.id} with ${
        Object.keys(documentContext.document.layers).length
      } layers`,
    )

    // 出力サイズを決定（指定されない場合は領域サイズと同じ）
    const textureWidth = outputWidth || Math.ceil(region.width)
    const textureHeight = outputHeight || Math.ceil(region.height)

    // オフスクリーンテクスチャを作成
    const renderTexture = this.createRenderTexture(textureWidth, textureHeight)
    if (!renderTexture) {
      console.error('Failed to create render texture for region rendering')
      return null
    }

    // スクロール中のエクスポートのズレを防ぐため、レンダリング前にキューを完了させる
    await this.device!.queue.onSubmittedWorkDone()

    // カメラの現在状態を保存
    const originalPosition = this.camera.getPosition()
    const originalZoom = this.camera.getZoom()

    // エクスポート用カメラの準備
    let originalCamera: Camera2D | null = null

    try {
      // アートボード境界内のコンテンツ範囲を計算（アートボード外のオブジェクトは無視）
      let actualContentBounds = {
        left: region.x,
        top: region.y,
        right: region.x + region.width,
        bottom: region.y + region.height,
      }

      let hasContent = false

      // アートボード境界内のアートオブジェクトのみを調査
      for (const artObject of Object.values(
        documentContext.document.artObjects,
      )) {
        if ((artObject as any).path?.points?.length > 0) {
          const pathObject = artObject as any
          for (const point of pathObject.path.points) {
            // アートボード境界内の点のみを考慮
            if (
              point.x >= region.x &&
              point.x <= region.x + region.width &&
              point.y >= region.y &&
              point.y <= region.y + region.height
            ) {
              actualContentBounds.left = Math.min(
                actualContentBounds.left,
                point.x,
              )
              actualContentBounds.top = Math.min(
                actualContentBounds.top,
                point.y,
              )
              actualContentBounds.right = Math.max(
                actualContentBounds.right,
                point.x,
              )
              actualContentBounds.bottom = Math.max(
                actualContentBounds.bottom,
                point.y,
              )
              hasContent = true
            }
          }
        }
      }

      // アートボード領域を常に使用（アートボード外のコンテンツはクリップ）
      const centerX = region.x + region.width / 2
      const centerY = region.y + region.height / 2

      const scaleX = textureWidth / region.width
      const scaleY = textureHeight / region.height
      const newZoom = Math.min(scaleX, scaleY)

      debugState.export.errors.push(
        `Using artboard bounds: (${region.x},${region.y}) ${region.width}x${region.height}`,
      )
      if (hasContent) {
        debugState.export.errors.push(`Content found within artboard bounds`)
      }

      const adjustedCenterX = centerX
      const adjustedCenterY = centerY

      // debugStateにカメラ情報を記録
      debugState.export.camera.originalPosition = {
        x: originalPosition.x,
        y: originalPosition.y,
      }
      debugState.export.camera.originalZoom = originalZoom
      debugState.export.camera.newPosition = {
        x: adjustedCenterX,
        y: adjustedCenterY,
      }
      debugState.export.camera.newZoom = newZoom

      // エクスポート用の一時的なカメラを作成
      const originalCamera = this.camera
      const exportCamera = originalCamera.clone() // カメラのクローンを作成
      exportCamera.setPosition(adjustedCenterX, adjustedCenterY)
      exportCamera.setZoom(newZoom)

      // 一時的にエクスポート用カメラを使用
      this.camera = exportCamera

      // NDC変換テスト（最初のオブジェクト位置で検証）
      if (
        debugState.export.rendering &&
        Object.values(documentContext.document.artObjects).length > 0
      ) {
        const firstObj = Object.values(
          documentContext.document.artObjects,
        )[0] as any
        if (firstObj.path?.points?.length > 0) {
          const testPoint = firstObj.path.points[0]
          const relX = testPoint.x - adjustedCenterX
          const relY = testPoint.y - adjustedCenterY
          const ndcX = (2 * relX * newZoom) / textureWidth
          const ndcY = -(2 * relY * newZoom) / textureHeight
          debugState.export.errors.push(
            `NDC test: obj(${testPoint.x},${testPoint.y}) -> NDC(${ndcX.toFixed(
              2,
            )},${ndcY.toFixed(2)})`,
          )
        }
      }

      // カメラ行列の確認
      debugState.export.errors.push(
        `Camera setup: center(${centerX.toFixed(1)}, ${centerY.toFixed(
          1,
        )}) zoom=${newZoom}`,
      )
      debugState.export.errors.push(
        `Texture size: ${textureWidth}x${textureHeight}`,
      )
      debugState.export.errors.push(
        `Region: ${region.x},${region.y} ${region.width}x${region.height}`,
      )

      // レンダリング対象の確認
      const artObjectCount = Object.keys(
        documentContext.document.artObjects,
      ).length
      debugState.stroke.document.artObjectCount = artObjectCount

      // エクスポート時のレンダリング統計をリセット
      debugState.export.rendering = {
        layersProcessed: 0,
        artObjectsProcessed: 0,
        visibleLayers: 0,
        pathsRendered: 0,
        fillsRendered: 0,
        strokesRendered: 0,
        skippedObjects: 0,
        renderErrors: [],
      }

      // 専用テクスチャにレンダリング実行
      debugState.export.errors.push(
        `Calling renderRegion with texture ${renderTexture.width}x${renderTexture.height}`,
      )

      // 仮説15テスト: シェーダー段階の問題を特定するためのテクスチャフォーマット整合性確認
      debugState.export.errors.push(
        `DEBUG-TOKEN-DEF789: Shader-stage debugging - texture format verification`,
      )

      // テクスチャフォーマット確認
      const renderTextureFormat = renderTexture.format
      debugState.export.errors.push(
        `DEBUG-TOKEN-DEF789: RenderTexture format: ${renderTextureFormat}`,
      )

      // FillRendererが想定するフォーマットと一致するかチェック
      const expectedFormat = 'rgba8unorm'
      const formatMatches = renderTextureFormat === expectedFormat
      debugState.export.errors.push(
        `DEBUG-TOKEN-DEF789: Format matches expected (${expectedFormat}): ${
          formatMatches ? 'YES' : 'NO'
        }`,
      )

      // renderRegion実行前のベースライン確認
      const baselineBuffer = this.device!.createBuffer({
        size: 16, // 1ピクセル分
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      const baselineEncoder = this.device!.createCommandEncoder({
        label: 'BaselineSample',
      })
      baselineEncoder.copyTextureToBuffer(
        {
          texture: renderTexture,
          origin: {
            x: Math.floor(textureWidth / 2),
            y: Math.floor(textureHeight / 2),
            z: 0,
          },
        },
        { buffer: baselineBuffer, bytesPerRow: 256 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      )
      this.device!.queue.submit([baselineEncoder.finish()])

      await this.device!.queue.onSubmittedWorkDone()
      await baselineBuffer.mapAsync(GPUMapMode.READ)
      const baselineData = new Uint8Array(baselineBuffer.getMappedRange())

      const baselinePixel = {
        r: baselineData[0],
        g: baselineData[1],
        b: baselineData[2],
        a: baselineData[3],
      }
      debugState.export.errors.push(
        `DEBUG-TOKEN-DEF789: BASELINE before renderRegion: RGBA(${baselinePixel.r},${baselinePixel.g},${baselinePixel.b},${baselinePixel.a})`,
      )

      baselineBuffer.unmap()
      baselineBuffer.destroy()

      // ビューポート領域を指定してレンダリング
      // 実際のアートボードレンダリングを実行
      debugState.export.errors.push(`DEBUG: Executing full artboard rendering`)

      await this.renderRegion(
        documentContext,
        {
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
        },
        renderTexture,
      )

      debugState.export.errors.push(`renderRegion completed (actual rendering)`)

      // 仮説15テスト: renderRegion後のシェーダー実行結果を確認
      debugState.export.errors.push(
        `DEBUG-TOKEN-DEF789: Post-renderRegion shader execution verification`,
      )
      const postRenderBuffer = this.device!.createBuffer({
        size: 16, // 1ピクセル分
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      const postRenderEncoder = this.device!.createCommandEncoder({
        label: 'PostRenderSample',
      })
      postRenderEncoder.copyTextureToBuffer(
        {
          texture: renderTexture,
          origin: {
            x: Math.floor(textureWidth / 2),
            y: Math.floor(textureHeight / 2),
            z: 0,
          },
        },
        { buffer: postRenderBuffer, bytesPerRow: 256 },
        { width: 1, height: 1, depthOrArrayLayers: 1 },
      )
      this.device!.queue.submit([postRenderEncoder.finish()])

      await this.device!.queue.onSubmittedWorkDone()
      await postRenderBuffer.mapAsync(GPUMapMode.READ)
      const postRenderData = new Uint8Array(postRenderBuffer.getMappedRange())

      const postRenderPixel = {
        r: postRenderData[0],
        g: postRenderData[1],
        b: postRenderData[2],
        a: postRenderData[3],
      }
      debugState.export.errors.push(
        `DEBUG-TOKEN-DEF789: AFTER renderRegion: RGBA(${postRenderPixel.r},${postRenderPixel.g},${postRenderPixel.b},${postRenderPixel.a})`,
      )

      postRenderBuffer.unmap()
      postRenderBuffer.destroy()

      // 実際のレンダリング結果に焦点を当てる
      debugState.export.errors.push(
        `DEBUG-TOKEN-HIJ567: Focus on actual rendering results`,
      )
      debugState.export.errors.push(
        `DEBUG-TOKEN-HIJ567: Expected: orange and green shapes`,
      )
      debugState.export.errors.push(
        `DEBUG-TOKEN-HIJ567: Actual: RGBA(0,0,0,0) - transparent`,
      )

      // 仮説4テスト: canvasTextureをチェック（Fill/Strokeが間違ったテクスチャに描画している可能性）
      debugState.export.errors.push(
        `DEBUG-TOKEN-JKL012: Checking canvasTexture for misdirected rendering`,
      )

      // canvasTextureから中央部をサンプリング
      const sampleCenterX = Math.floor(textureWidth / 2)
      const sampleCenterY = Math.floor(textureHeight / 2)

      const canvasBuffer = this.device!.createBuffer({
        size: 64, // 16ピクセル分 (4 bytes per pixel)
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      const canvasEncoder = this.device!.createCommandEncoder({
        label: 'SampleCanvasTexture',
      })
      canvasEncoder.copyTextureToBuffer(
        {
          texture: this.context!.getCurrentTexture(),
          origin: { x: sampleCenterX - 8, y: sampleCenterY, z: 0 },
        },
        { buffer: canvasBuffer, bytesPerRow: 256 },
        { width: 16, height: 1, depthOrArrayLayers: 1 },
      )
      this.device!.queue.submit([canvasEncoder.finish()])

      await this.device!.queue.onSubmittedWorkDone()
      await canvasBuffer.mapAsync(GPUMapMode.READ)
      const canvasData = new Uint8Array(canvasBuffer.getMappedRange())

      const canvasPixel = {
        r: canvasData[32], // 中央ピクセル (8番目 * 4)
        g: canvasData[33],
        b: canvasData[34],
        a: canvasData[35],
      }
      debugState.export.errors.push(
        `DEBUG-TOKEN-JKL012: Canvas center pixel: RGBA(${canvasPixel.r},${canvasPixel.g},${canvasPixel.b},${canvasPixel.a})`,
      )

      canvasBuffer.unmap()
      canvasBuffer.destroy()

      // renderTextureサンプリング
      const renderBuffer = this.device!.createBuffer({
        size: 64,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      const renderEncoder = this.device!.createCommandEncoder({
        label: 'SampleRenderTexture',
      })
      renderEncoder.copyTextureToBuffer(
        {
          texture: renderTexture,
          origin: { x: sampleCenterX - 8, y: sampleCenterY, z: 0 },
        },
        { buffer: renderBuffer, bytesPerRow: 256 },
        { width: 16, height: 1, depthOrArrayLayers: 1 },
      )
      this.device!.queue.submit([renderEncoder.finish()])

      await this.device!.queue.onSubmittedWorkDone()
      await renderBuffer.mapAsync(GPUMapMode.READ)
      const renderData = new Uint8Array(renderBuffer.getMappedRange())

      const renderPixel = {
        r: renderData[32],
        g: renderData[33],
        b: renderData[34],
        a: renderData[35],
      }
      debugState.export.errors.push(
        `DEBUG-TOKEN-JKL012: RenderTexture center pixel: RGBA(${renderPixel.r},${renderPixel.g},${renderPixel.b},${renderPixel.a})`,
      )

      renderBuffer.unmap()
      renderBuffer.destroy()

      // レンダリング完了を確実に待つ
      if (this.device) {
        await this.device.queue.onSubmittedWorkDone()
      }

      // レンダリング完了をdebugStateに記録
      debugState.export.artboard.renderEndTime = performance.now()

      // レンダリング統計をログに出力（1回のみ）
      if (!debugState.export.errors.some((e) => e.startsWith('Stats:'))) {
        if (
          debugState.export.rendering.layersProcessed > 0 ||
          debugState.export.rendering.artObjectsProcessed > 0
        ) {
          debugState.export.errors.push(
            `Stats: L${debugState.export.rendering.layersProcessed} O${debugState.export.rendering.artObjectsProcessed} P${debugState.export.rendering.pathsRendered} F${debugState.export.rendering.fillsRendered} S${debugState.export.rendering.strokesRendered} Skip${debugState.export.rendering.skippedObjects}`,
          )
        } else {
          debugState.export.errors.push('No objects processed during rendering')
        }
      }

      return renderTexture
    } catch (error) {
      console.error('Error during region rendering:', error)
      renderTexture.destroy()
      return null
    } finally {
      // カメラを元に戻す
      if (originalCamera) {
        this.camera = originalCamera
      }

      // 再帰カウンターをリセット
      if (this.renderCallCount) {
        this.renderCallCount.delete(callKey)
      }
    }
  }

  /**
   * 領域レンダリング結果をImageDataとして取得
   * @param region ワールド座標での領域
   * @param outputWidth 出力幅（デフォルト：region.width）
   * @param outputHeight 出力高さ（デフォルト：region.height）
   * @returns ImageDataまたはnull
   */
  async renderRegionToImageData(
    region: { x: number; y: number; width: number; height: number },
    outputWidth?: number,
    outputHeight?: number,
    documentContext?: DocumentContext,
  ): Promise<ImageData | null> {
    const texture = await this.renderRegionToTexture(
      region,
      outputWidth,
      outputHeight,
      documentContext,
    )
    if (!texture) {
      return null
    }

    try {
      const imageData = await this.readTextureAsImageData(texture)
      debugState.export.errors.push(
        `readTextureAsImageData result: ${
          imageData ? `${imageData.width}x${imageData.height}` : 'null'
        }`,
      )
      return imageData
    } finally {
      // テクスチャリソースをクリーンアップ
      texture.destroy()
    }
  }

  /**
   * キャンバス座標をワールド座標に変換（カメラ考慮版）
   */
  canvasToWorld(canvasX: number, canvasY: number): Vector2 {
    const canvasSize = this.getLogicalCanvasSize()
    return this.camera.screenToWorld(
      canvasX,
      canvasY,
      canvasSize.width,
      canvasSize.height,
    )
  }

  /**
   * ワールド座標をキャンバス座標に変換（カメラ考慮版）
   */
  worldToCanvas(worldX: number, worldY: number): Vector2 {
    const canvasSize = this.getLogicalCanvasSize()
    return this.camera.worldToScreen(
      worldX,
      worldY,
      canvasSize.width,
      canvasSize.height,
    )
  }
}
