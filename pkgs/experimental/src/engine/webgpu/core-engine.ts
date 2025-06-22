import { proxy } from 'valtio'
import { Camera2D } from '../camera/camera-2d'
import {
  type Appearance,
  isFillAppearance,
  isStrokeAppearance,
} from '../document/appearance'
import { isCanvasArtObject } from '../document/art-object'
import { createDocument } from '../document/document'
import type { VectorPath } from '../document/path'
import { DocumentContext } from '../document-manager'
import { EngineError, ErrorCode } from '../exceptions'
import { setDocumentAccessFunction } from '../selection-state'
import type { EngineState, RenderDebugInfo, Vector2 } from '../state'
import { CanvasRenderer } from './appearances/canvas-renderer'
import { FillRenderer } from './appearances/fill-renderer'
import { StrokeRenderer } from './appearances/stroke-renderer'
import { LayerCompositor } from './compositing/layer-compositor'
import { OffscreenTexturePool } from './compositing/offscreen-texture-pool'
import { HitTester } from './hit-test/hit-test'
import type { HitTestResult } from './hit-test/types'
import {
  UIManager,
  type WebGPUComponentContext,
  type WebGPUIDeclaration,
} from './ui'
import { UIComponentManager } from './ui/ui-component-manager'

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
  webgpuEngine: {
    endDrawing: null as any, // 描画終了時の状態を記録
    previewStrokeCheck: null as any, // プレビューストローク描画条件チェック
    renderPreviewStrokeSkipped: null as any, // プレビューストロークスキップ理由
    renderingPreviewStroke: null as any, // プレビューストローク描画中の情報
    previewStrokeError: null as any, // プレビューストロークエラー
    startDrawingCall: null as any, // startDrawing呼び出し記録
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
    backgroundDebugData: null as any,
    backgroundSuccessData: null as any,
    documentStateData: null as any,
    foregroundDebugData: null as any,
    foregroundSuccessData: null as any,
    legacyDebugData: null as any,
    legacySuccessData: null as any,
    particleDebugData: null as any,
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
    instanceBuffer: {
      maxInstances: 0,
      requestedInstances: 0,
      actualInstances: 0,
      overflow: false,
      lastOverflowAt: null as number | null,
      totalLength: 0,
      baseSpacing: 0,
      overflowDetails: null as {
        totalRequested: number
        capped: number
        overflowAmount: number
        timestamp: number
      } | null,
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
      // 各ストロークの詳細状態（毎フレームクリア）
      perStrokeData: {} as Record<
        string,
        {
          id: string
          type: 'preview' | 'document'
          attemptTime: number
          pointCount: number
          instanceCount: number
          appearances: Array<{
            type: string
            enabled: boolean
            width?: number
            color?: { r: number; g: number; b: number; a: number }
            brushTexture?: string
          }>
          geometryData: {
            pathLength: number
            boundingBox: {
              x: number
              y: number
              width: number
              height: number
            }
            segmentCount: number
          }
          pipelineStages: {
            instanceGeneration: {
              success: boolean
              duration: number
              error?: string
            }
            vertexBuffer: { success: boolean; size: number; error?: string }
            texture: { success: boolean; bound: boolean; error?: string }
            compute: { success: boolean; duration: number; error?: string }
            render: {
              success: boolean
              duration: number
              drawCalls: number
              error?: string
            }
          }
          renderResult: {
            success: boolean
            visible: boolean
            error?: string
            finalInstanceCount: number
          }
        }
      >,
      frameStats: {
        totalStrokesAttempted: 0,
        previewStrokesAttempted: 0,
        documentStrokesAttempted: 0,
        successfulStrokes: 0,
        failedStrokes: 0,
        averageRenderTime: 0,
      },
      brushSettingsSource: null as {
        artObjectId: string
        hasAppearanceBrushSettings: boolean
        usingCurrentSettings: boolean
        brushTexture?: string
        scatterCount?: number
      } | null,
    },
    tempStrokeTransition: null as {
      debugToken: string
      timestamp: string
      action: string
      previousTempStrokeId: string | null
      currentStrokePoints: number
      isDrawing: boolean
      newPermanentId?: string
      layerId?: string
      strokeParams?: {
        width: number
        brushTexture?: string
        scatterCount?: number
      }
    } | null,
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
    particleDebug: {
      lastRenderCall: {
        timestamp: 0,
        instanceCount: 0,
        actualDrawnInstances: 0,
        hasCurrentStroke: false,
        currentStrokePointCount: 0,
        bufferCleared: false,
        vertexShaderFiltered: 0,
        fragmentShaderDiscarded: 0,
      },
      renderingStats: {
        totalRenderCalls: 0,
        emptyRenderCalls: 0,
        lastEmptyRenderReason: null as string | null,
      },
    },
    pipelineError: null as any,
    texturePixelAnalysis: null as any,
    textureCoordinates: null as any,
    strokeSaveData: null as any,
    commandExecution: null as any,
    documentChanges: {
      lastChangeTime: 0,
      changeHistory: [] as Array<{
        timestamp: number
        action: string
        before: { artObjectCount: number; artObjectIds: string[] }
        after: { artObjectCount: number; artObjectIds: string[] }
        stackTrace: string
      }>,
    },
    layerProcessing: null as any,
    artObjectLookup: null as any,
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
  paplicoEngine: {
    renderOptimization: {
      needsRender: false,
      lastRenderTime: 0,
      renderCheckInterval: 16,
      frameSkipped: 0,
      totalFrames: 0,
      renderRequestCount: 0,
      lastRenderReason: null as string | null,
    },
    input: {
      currentTool: null as string | null,
      isMouseDown: false,
      isPanning: false,
      isZooming: false,
      pointerCount: 0,
      lastEventTimestamp: 0,
      eventCount: {
        pointerDown: 0,
        pointerMove: 0,
        pointerUp: 0,
        wheel: 0,
        touch: 0,
      },
    },
    camera: {
      position: { x: 0, y: 0 },
      zoom: 1,
      rotation: 0,
      viewport: { width: 0, height: 0 },
      transformationCount: 0,
      lastTransformTimestamp: 0,
    },
    document: {
      activeDocumentId: null as string | null,
      layerCount: 0,
      artObjectCount: 0,
      artboardCount: 0,
      lastModified: 0,
      documentChanges: 0,
    },
    performance: {
      initializationTime: 0,
      totalRenderTime: 0,
      averageFrameTime: 0,
      lastGcTime: 0,
      memoryUsage: {
        used: 0,
        total: 0,
        limit: 0,
      },
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
            spread: 2,
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
      // tools は PaplicoEngine に移動
      isDrawing: false,
      currentStroke: null,
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
  }

  private async createRenderPipeline() {
    if (!this.device) throw new EngineError(ErrorCode.WebGPUDeviceNotAvailable)

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
  }

  private async createLineRenderPipeline() {
    if (!this.device) throw new EngineError(ErrorCode.WebGPUDeviceNotAvailable)

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
  }

  private async createTextRenderPipeline() {
    if (!this.device) throw new EngineError(ErrorCode.WebGPUDeviceNotAvailable)

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
  }

  private async createSimpleFillPipeline() {
    if (!this.device) throw new EngineError(ErrorCode.WebGPUDeviceNotAvailable)

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

    const layer = document.layers[node.layerId]

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
      // レイヤー内のartObjectIds処理開始時のデバッグ情報をdebugStateに保存
      debugState.stroke.layerProcessing = {
        debugToken: `layer-processing-v1-${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        action: 'process_layer_artobjects',
        layerId: layer.id,
        layerType: layer.type,
        artObjectIds: layer.artObjectIds,
        artObjectIdsCount: layer.artObjectIds.length,
        totalDocumentArtObjects: Object.keys(document.artObjects).length,
        documentArtObjectIds: Object.keys(document.artObjects),
      }

      for (const artObjectId of layer.artObjectIds) {
        const artObject = document.artObjects[artObjectId]

        // 詳細なデバッグ情報をdebugStateに保存
        debugState.stroke.artObjectLookup = {
          debugToken: `artobject-lookup-v1-${crypto.randomUUID()}`,
          timestamp: new Date().toISOString(),
          action: 'lookup_artobject',
          artObjectId,
          found: !!artObject,
          visible: artObject?.visible,
          type: artObject?.type,
          artObjectExists: artObjectId in document.artObjects,
          artObjectData: artObject
            ? {
                id: artObject.id,
                layerId: artObject.layerId,
                type: artObject.type,
                visible: artObject.visible,
              }
            : null,
        }

        if (!artObject || !artObject.visible) {
          debugState.stroke.artObjectLookup.skipped = true
          debugState.stroke.artObjectLookup.skipReason = !artObject
            ? 'not_found'
            : 'not_visible'
          continue
        }

        // デバッグ: アートオブジェクトが見つかった場合
        const renderDebugData = {
          debugToken: `core-engine-render-v1-${Math.random().toString(36).substring(2)}`,
          timestamp: new Date().toISOString(),
          action: 'stroke_rendering',
          artObjectId,
          layerId: layer.id,
          artObject: {
            type: artObject.type,
            visible: artObject.visible,
            hasPath: artObject.type === 'path' && !!(artObject as any).path,
            pointCount:
              artObject.type === 'path'
                ? (artObject as any).path?.points?.length || 0
                : 0,
            appearances: artObject.appearances?.map((a: any) => ({
              type: a.type,
              enabled: a.enabled,
              params:
                a.type === 'stroke'
                  ? {
                      width: a.params?.width,
                      color: a.params?.color,
                      hasbrushSettings: !!a.params?.brushSettings,
                    }
                  : {},
            })),
          },
          layer: {
            id: layer.id,
            type: layer.type,
            visible: layer.visible,
            opacity: layer.opacity || 1.0,
            artObjectIds: (layer as any).artObjectIds || [],
          },
        }

        // 最初のストロークレンダリング時のみデバッグ情報をdebugStateに保存
        if (
          artObject.type === 'path' &&
          !(window as any).__strokeRenderDebugSaved
        ) {
          ;(window as any).__strokeRenderDebugSaved = true
          debugState.stroke.renderDebugData = renderDebugData
        }
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
      return
    }

    // PathArtObjectのパスデータをVectorPathに変換
    const vectorPath: VectorPath = {
      points: artObject.path.points,
      closed: artObject.path.closed || false,
    }

    // ドキュメントストロークの詳細状態を記録
    const strokeId = artObject.id
    const attemptTime = performance.now()
    debugState.stroke.rendering.frameStats.totalStrokesAttempted++
    debugState.stroke.rendering.frameStats.documentStrokesAttempted++

    const strokeData = {
      id: strokeId,
      type: 'document' as const,
      attemptTime,
      pointCount: artObject.path.points.length,
      instanceCount: 0,
      appearances: artObject.appearances.map((a: any) => ({
        effectId: a.effectId,
        enabled: a.enabled,
        width: a.params?.width,
        color: a.params?.color,
        brushTexture: a.params?.brushSettings?.texture,
      })),
      geometryData: {
        pathLength: 0,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        segmentCount: Math.max(0, artObject.path.points.length - 1),
      },
      pipelineStages: {
        instanceGeneration: { success: false, duration: 0 },
        vertexBuffer: { success: false, size: 0 },
        texture: { success: false, bound: false },
        compute: { success: false, duration: 0 },
        render: { success: false, duration: 0, drawCalls: 0 },
      },
      renderResult: {
        success: false,
        visible: false,
        finalInstanceCount: 0,
      },
    }

    debugState.stroke.rendering.perStrokeData[strokeId] = strokeData

    // 各アピアランスを処理
    for (const appearance of artObject.appearances) {
      if (!appearance.enabled) continue
      if (isStrokeAppearance(appearance)) {
        if (this.strokeRenderer) {
          // エクスポート時はアルファ値を強制的に上げる
          const exportAppearance = {
            ...appearance,
            params: {
              ...appearance.params,
              opacity: Math.max(appearance.params.opacity * layerOpacity, 0.5),
            },
          }

          // 一時ストロークと同じレンダリングパイプラインを使用
          const pipelineStartTime = performance.now()
          debugState.stroke.rendering.perStrokeData[strokeId].pipelineStages
            .render.drawCalls++

          try {
            await this.renderStrokePipeline(
              renderPass,
              vectorPath,
              exportAppearance,
              1.0, // layerOpacityは既にappearanceに適用済み
              buffersToDestroy,
              artObject.id,
            )

            // 成功時の状態記録
            const pipelineDuration = performance.now() - pipelineStartTime
            debugState.stroke.rendering.perStrokeData[
              strokeId
            ].pipelineStages.render.success = true
            debugState.stroke.rendering.perStrokeData[
              strokeId
            ].pipelineStages.render.duration = pipelineDuration
            debugState.stroke.rendering.perStrokeData[
              strokeId
            ].renderResult.success = true
            debugState.stroke.rendering.perStrokeData[
              strokeId
            ].renderResult.visible = true
            debugState.stroke.rendering.frameStats.successfulStrokes++
          } catch (error) {
            // 失敗時の状態記録
            const pipelineDuration = performance.now() - pipelineStartTime
            debugState.stroke.rendering.perStrokeData[
              strokeId
            ].pipelineStages.render.success = false
            debugState.stroke.rendering.perStrokeData[
              strokeId
            ].pipelineStages.render.duration = pipelineDuration
            debugState.stroke.rendering.perStrokeData[
              strokeId
            ].pipelineStages.render.error =
              error instanceof Error ? error.message : String(error)
            debugState.stroke.rendering.perStrokeData[
              strokeId
            ].renderResult.success = false
            debugState.stroke.rendering.perStrokeData[
              strokeId
            ].renderResult.error =
              error instanceof Error ? error.message : String(error)
            debugState.stroke.rendering.frameStats.failedStrokes++

            console.error(
              `[StrokeDebug] Failed to render document stroke ${artObject.id}:`,
              error,
            )
            debugState.stroke.rendering.lastError =
              error instanceof Error ? error.message : String(error)
            debugState.stroke.rendering.lastErrorLocation =
              'renderPathArtObject'
          }
        }
      } else if (isFillAppearance(appearance) && this.fillRenderer) {
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
        } catch (_error) {}
      }
    }
  }

  /**
   * CanvasArtObjectをレンダリング
   */
  private async renderCanvasArtObject(
    renderPass: GPURenderPassEncoder,
    artObject: any,
    _layerOpacity: number,
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
    } catch (_error) {}
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
  public async renderRegion(
    documentContext?: DocumentContext,
    region?: { x: number; y: number; width: number; height: number },
    targetTexture?: GPUTexture,
    _cameraOverride?: { position: { x: number; y: number }; zoom: number },
  ) {
    if (!this.device || !this.context || !this.renderPipeline) {
      return
    }

    // キャンバスサイズをチェック
    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height

    if (canvasWidth <= 0 || canvasHeight <= 0) {
      console.error(`Invalid canvas size: ${canvasWidth}x${canvasHeight}`)
      debugState.ui.errorCount++
      debugState.ui.lastError = `Invalid canvas size: ${canvasWidth}x${canvasHeight}`
      return
    }

    // UIデバッグ情報をフレーム毎にリセット
    debugState.ui.renderOrder = []

    // ストロークデバッグ情報をフレーム毎にリセット
    debugState.stroke.rendering.perStrokeData = {}
    debugState.stroke.rendering.frameStats.totalStrokesAttempted = 0
    debugState.stroke.rendering.frameStats.previewStrokesAttempted = 0
    debugState.stroke.rendering.frameStats.documentStrokesAttempted = 0
    debugState.stroke.rendering.frameStats.successfulStrokes = 0
    debugState.stroke.rendering.frameStats.failedStrokes = 0

    // 重複レンダリング検出用
    ;(debugState.stroke as any).duplicateRenderCheck = {
      frameNumber: this.frameNumber,
      tempStrokeIds: new Set<string>(),
      permanentStrokeIds: new Set<string>(),
      duplicates: [] as Array<{ id: string; type: string; timestamp: number }>,
    }

    // documentContextが提供されていない場合は、state.documentから作成
    if (!documentContext) return

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
    const _renderTexture = targetTexture || canvasTexture
    const renderTextureView = targetTexture
      ? targetTexture.createView({ label: 'CustomTargetTextureView' })
      : canvasTexture.createView({ label: 'VectorPaintCanvasTextureView' })

    // 現在のレンダーターゲットを保存
    this.currentRenderTargetTexture = targetTexture || null

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
      // Background UI components debug info
      const bgUIDebugData = {
        debugToken: `ui-background-v1-${Math.random().toString(36).substring(2)}`,
        timestamp: new Date().toISOString(),
        action: 'ui_background_render_start',
        componentType: 'background',
      }

      debugState.ui.backgroundDebugData = bgUIDebugData

      try {
        await this.renderUIComponentsBackground(
          renderPass,
          documentContext,
          buffersToDestroy,
        )

        // Background UI success debug info
        debugState.ui.backgroundSuccessData = {
          ...bgUIDebugData,
          action: 'ui_background_render_success',
        }
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

      // ドキュメント全体のデバッグ情報を保存（毎回更新）
      if (strokeArtObjectCount > 0) {
        const documentDebugData = {
          debugToken: `document-state-v1-${Math.random().toString(36).substring(2)}`,
          timestamp: new Date().toISOString(),
          action: 'document_state',
          document: {
            id: document.id,
            layerCount: Object.keys(document.layers).length,
            artObjectCount: Object.keys(document.artObjects).length,
            visibleLayerCount,
            strokeLayerCount,
            strokeArtObjectCount,
            layers: Object.values(document.layers).map((l: any) => ({
              id: l.id,
              type: l.type,
              visible: l.visible,
              artObjectIds: l.artObjectIds || [],
              artObjectCount: l.artObjectIds?.length || 0,
            })),
            artObjects: Object.entries(document.artObjects).map(
              ([id, obj]: [string, any]) => ({
                id,
                type: obj.type,
                layerId: obj.layerId,
                visible: obj.visible,
                pointCount:
                  obj.type === 'path' ? obj.path?.points?.length || 0 : 0,
              }),
            ),
          },
        }

        debugState.ui.documentStateData = documentDebugData
      }

      // 2. アートオブジェクト・レイヤーを描画
      debugState.ui.drawOrder.push({
        type: 'artobjects',
        timestamp: performance.now(),
      })

      await this.renderDownLayerTree(
        renderPass,
        buffersToDestroy,
        documentContext,
      )
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

    // debugStateに記録
    debugState.webgpuEngine = debugState.webgpuEngine || {}
    debugState.webgpuEngine.previewStrokeCheck = {
      hasTargetTexture: !!targetTexture,
      hasStrokeRenderer: !!this.strokeRenderer,
      hasCurrentStroke: !!this.state.currentStroke,
      currentTempStrokeId: this.currentTempStrokeId,
      isDrawing: this.state.isDrawing,
      pointsLength: this.state.currentStroke?.points?.length || 0,
      timestamp: Date.now(),
    }

    if (
      !targetTexture &&
      this.strokeRenderer &&
      this.state.isDrawing &&
      this.state.currentStroke &&
      this.state.currentStroke.points.length >= 2
    ) {
      // debugStateに記録
      debugState.webgpuEngine.renderingPreviewStroke = {
        tempStrokeId: this.currentTempStrokeId,
        pointsLength: this.state.currentStroke.points.length,
        timestamp: Date.now(),
      }

      // プレビューストロークのデバッグ情報を記録
      debugState.stroke.particleDebug.lastRenderCall.hasCurrentStroke = true
      debugState.stroke.particleDebug.lastRenderCall.currentStrokePointCount =
        this.state.currentStroke.points.length
      try {
        await this.renderPreviewStroke(
          renderPass,
          this.state.currentStroke,
          buffersToDestroy,
          documentContext,
        )
        pathsRendered++
      } catch (error) {
        debugState.webgpuEngine.previewStrokeError =
          error instanceof Error ? error.message : String(error)
        debugState.ui.errorCount++
        debugState.ui.lastError =
          error instanceof Error ? error.message : String(error)
      }
    } else {
      // プレビューストロークがない場合のデバッグ情報
      debugState.stroke.particleDebug.renderingStats.emptyRenderCalls++
      debugState.stroke.particleDebug.renderingStats.lastEmptyRenderReason =
        !this.strokeRenderer
          ? 'no strokeRenderer'
          : !this.state.currentStroke
            ? 'no currentStroke'
            : this.state.currentStroke.points.length < 2
              ? 'insufficient points'
              : targetTexture
                ? 'export mode'
                : 'unknown'

      // パーティクルデバッグ情報をAPIに送信（空のレンダリングの場合）
      if (
        debugState.stroke.particleDebug.renderingStats.emptyRenderCalls % 10 ===
        1
      ) {
        const particleDebugData = {
          debugToken: `particle-debug-v1-${Math.random().toString(36).substring(2)}`,
          timestamp: new Date().toISOString(),
          action: 'empty_render_analysis',
          debugState: {
            stroke: {
              particleDebug: debugState.stroke.particleDebug,
              rendering: {
                callCount: debugState.stroke.rendering.callCount,
                lastCallTime: debugState.stroke.rendering.lastCallTime,
                lastInstanceCount:
                  debugState.stroke.rendering.lastInstanceCount,
                successCount: debugState.stroke.rendering.successCount,
                failureCount: debugState.stroke.rendering.failureCount,
              },
            },
          },
          currentState: {
            hasStrokeRenderer: !!this.strokeRenderer,
            hasCurrentStroke: !!this.state.currentStroke,
            currentStrokePoints: this.state.currentStroke?.points?.length || 0,
            activeTool: 'unknown', // activeToolはPaplicoEngine側で管理
            isExportMode: !!targetTexture,
          },
        }

        debugState.ui.particleDebugData = particleDebugData
      }
    }

    // 4. 前景UIコンポーネントを描画（選択ハンドルなど）
    // エクスポート時はUIコンポーネントをスキップ
    if (!targetTexture) {
      debugState.ui.drawOrder.push({
        type: 'ui-foreground',
        timestamp: performance.now(),
      })
      // Foreground UI components debug info
      const fgUIDebugData = {
        debugToken: `ui-foreground-v1-${Math.random().toString(36).substring(2)}`,
        timestamp: new Date().toISOString(),
        action: 'ui_foreground_render_start',
        componentType: 'foreground',
      }

      debugState.ui.foregroundDebugData = fgUIDebugData

      try {
        await this.renderUIComponentsForeground(
          renderPass,
          documentContext,
          buffersToDestroy,
        )

        // Foreground UI success debug info
        debugState.ui.foregroundSuccessData = {
          ...fgUIDebugData,
          action: 'ui_foreground_render_success',
        }
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
      // Legacy UI components debug info
      const legacyUIDebugData = {
        debugToken: `ui-legacy-v1-${Math.random().toString(36).substring(2)}`,
        timestamp: new Date().toISOString(),
        action: 'ui_legacy_render_start',
        componentType: 'legacy',
        hasUIManager: !!this.uiManager,
      }

      debugState.ui.legacyDebugData = legacyUIDebugData

      const canvasSize = this.getLogicalCanvasSize()
      const uiBuffers = await this.uiManager.renderUI(
        renderPass,
        documentContext,
        this.camera,
        canvasSize,
        this,
      )

      // Legacy UI success debug info
      debugState.ui.legacySuccessData = {
        ...legacyUIDebugData,
        action: 'ui_legacy_render_success',
        buffersGenerated: uiBuffers.length,
        canvasSize,
      }
      buffersToDestroy.push(...uiBuffers)
    }

    renderPass.end()

    // コマンドバッファー送信後にサンプリング結果を確認
    const commandBuffer = commandEncoder.finish()
    this.device.queue.submit([commandBuffer])

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

    // フレームサマリーをログ出力（重複検出結果含む）
    const duplicateCheck = (debugState.stroke as any).duplicateRenderCheck
    if (duplicateCheck && duplicateCheck.duplicates.length > 0) {
      console.log('[StrokeDebug] Frame summary with duplicates:', {
        frameNumber: this.frameNumber,
        tempStrokes: duplicateCheck.tempStrokeIds.size,
        permanentStrokes: duplicateCheck.permanentStrokeIds.size,
        duplicates: duplicateCheck.duplicates,
        hasCurrentStroke: !!this.state.currentStroke,
        isDrawing: this.state.isDrawing,
      })
    }

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
    // debugStateに記録
    debugState.webgpuEngine.startDrawingCall = {
      wasDrawing: this.state.isDrawing,
      hadCurrentStroke: !!this.state.currentStroke,
      pathPoints: path.points.length,
      stackTrace: new Error().stack?.split('\n').slice(1, 5).join('\n'),
      timestamp: Date.now(),
    }

    this.state.isDrawing = true
    this.state.currentStroke = path
    // 一時ストローク用の決定的なIDを生成
    this.currentTempStrokeId = this.generateTempStrokeId(path)
  }

  /**
   * 描画終了
   */
  endDrawing(_document: any): void {
    // debugStateに記録
    debugState.webgpuEngine.endDrawing = {
      called: true,
      before: {
        currentTempStrokeId: this.currentTempStrokeId,
        hasCurrentStroke: !!this.state.currentStroke,
        currentStrokePoints: this.state.currentStroke?.points?.length || 0,
        isDrawing: this.state.isDrawing,
        timestamp: Date.now(),
      },
      after: null as any, // 後で設定
    }

    // デバッグ: 一時ストロークIDの状態遷移を記録
    debugState.stroke.tempStrokeTransition = {
      debugToken: `temp-stroke-transition-v1-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      action: 'end_drawing',
      previousTempStrokeId: this.currentTempStrokeId,
      currentStrokePoints: this.state.currentStroke?.points?.length || 0,
      isDrawing: this.state.isDrawing,
    }

    this.state.isDrawing = false
    this.state.currentStroke = null
    this.currentTempStrokeId = null

    // debugStateに完了後の状態を記録
    debugState.webgpuEngine.endDrawing.after = {
      currentTempStrokeId: this.currentTempStrokeId,
      hasCurrentStroke: !!this.state.currentStroke,
      isDrawing: this.state.isDrawing,
      timestamp: Date.now(),
    }

    // プレビューストローク情報もクリア
    debugState.webgpuEngine.renderingPreviewStroke = null
  }

  /**
   * 現在のストロークにポイントを追加
   */
  addPointToCurrentStroke(point: Vector2): void {
    if (this.state.currentStroke) {
      this.state.currentStroke.points.push(point)
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
   * @deprecated activeToolはPaplicoEngineで管理されるようになりました
   */
  setActiveTool(_tool: any): void {
    // activeToolはPaplicoEngineで管理されるため、何もしない
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

    // ストロークタイプを判定（プレビューか永続かドキュメントか）
    const isTemporaryStroke =
      artObjectId === this.currentTempStrokeId ||
      artObjectId.startsWith('temp-stroke-')
    const strokeType = isTemporaryStroke ? 'preview' : 'document'

    // 重複レンダリング検出
    const duplicateCheck = (debugState.stroke as any).duplicateRenderCheck
    if (duplicateCheck) {
      if (isTemporaryStroke) {
        if (duplicateCheck.tempStrokeIds.has(artObjectId)) {
          console.warn(
            '[StrokeDebug] Duplicate temp stroke render:',
            artObjectId,
          )
        }
        duplicateCheck.tempStrokeIds.add(artObjectId)
      } else {
        if (duplicateCheck.permanentStrokeIds.has(artObjectId)) {
          console.warn(
            '[StrokeDebug] Duplicate permanent stroke render:',
            artObjectId,
          )
        }
        duplicateCheck.permanentStrokeIds.add(artObjectId)

        // 同じストロークがtempとpermanentの両方でレンダリングされているかチェック
        const tempIds = duplicateCheck.tempStrokeIds as Set<string>
        const tempId = Array.from(tempIds).find((id) => {
          // 座標部分を比較して同じストロークか判定
          const tempParts = id.split('-')
          const permParts = artObjectId.split('-')
          return tempParts.length >= 4 && permParts.length >= 1
        })

        if (tempId) {
          duplicateCheck.duplicates.push({
            id: artObjectId,
            type: 'temp-permanent-duplicate',
            timestamp: performance.now(),
          })
          console.warn(
            '[StrokeDebug] Same stroke rendered as both temp and permanent:',
            {
              tempId,
              permanentId: artObjectId,
              frameNumber: duplicateCheck.frameNumber,
            },
          )
        }
      }
    }

    // プレビューストロークの場合は新規記録、ドキュメントストロークの場合は既存記録を更新
    if (isTemporaryStroke) {
      const attemptTime = performance.now()
      debugState.stroke.rendering.frameStats.totalStrokesAttempted++
      debugState.stroke.rendering.frameStats.previewStrokesAttempted++

      const strokeData = {
        id: artObjectId,
        type: strokeType as const,
        attemptTime,
        pointCount: vectorPath.points.length,
        instanceCount: 0,
        appearances: [
          {
            type: appearance.type,
            enabled: true,
            width: appearance.params?.width,
            color: appearance.params?.color,
            brushTexture: appearance.params?.brushSettings?.texture,
          },
        ],
        geometryData: {
          pathLength: 0,
          boundingBox: { x: 0, y: 0, width: 0, height: 0 },
          segmentCount: Math.max(0, vectorPath.points.length - 1),
        },
        pipelineStages: {
          instanceGeneration: { success: false, duration: 0 },
          vertexBuffer: { success: false, size: 0 },
          texture: { success: false, bound: false },
          compute: { success: false, duration: 0 },
          render: { success: false, duration: 0, drawCalls: 0 },
        },
        renderResult: {
          success: false,
          visible: false,
          finalInstanceCount: 0,
        },
      }

      debugState.stroke.rendering.perStrokeData[artObjectId] = strokeData
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

    // デバッグ: ブラシ設定の取得元を記録
    debugState.stroke.rendering.brushSettingsSource = {
      artObjectId,
      hasAppearanceBrushSettings: !!appearance.params.brushSettings,
      usingCurrentSettings: !appearance.params.brushSettings,
      brushTexture: brushSettings?.texture,
      scatterCount: brushSettings?.scatterConfig?.count,
    }

    const renderStartTime = performance.now()

    // レンダリング呼び出し情報を更新
    debugState.stroke.rendering.callCount++
    debugState.stroke.rendering.lastCallTime = renderStartTime
    debugState.stroke.rendering.lastPathPointCount = vectorPath.points.length
    debugState.stroke.rendering.lastArtObjectId = artObjectId

    try {
      // パイプライン段階の開始時刻記録
      const strokeData = debugState.stroke.rendering.perStrokeData[artObjectId]
      if (strokeData) {
        strokeData.pipelineStages.texture.bound = true // テクスチャが使用可能と仮定
        strokeData.pipelineStages.texture.success = true
        strokeData.pipelineStages.instanceGeneration.success = true
        strokeData.pipelineStages.instanceGeneration.duration =
          performance.now() - renderStartTime
      }

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

      // 成功時の詳細状態記録
      if (strokeData) {
        strokeData.pipelineStages.compute.success = true
        strokeData.pipelineStages.compute.duration =
          performance.now() - renderStartTime
        strokeData.pipelineStages.vertexBuffer.success = true
        strokeData.pipelineStages.vertexBuffer.size = buffers?.length || 0

        // render段階の成功を記録
        strokeData.pipelineStages.render.success = true
        strokeData.pipelineStages.render.duration =
          performance.now() - renderStartTime
        strokeData.pipelineStages.render.drawCalls = 1 // drawIndexedが1回呼ばれる

        strokeData.renderResult.success = true
        strokeData.renderResult.visible = true
        strokeData.renderResult.finalInstanceCount =
          debugState.stroke.rendering.lastInstanceCount || 0

        // frameStatsが未更新の場合のみ増加（ドキュメントストロークの場合は既に更新済み）
        if (strokeType === 'preview') {
          debugState.stroke.rendering.frameStats.successfulStrokes++
        }
      }

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
      // 失敗時の詳細状態記録
      const strokeData = debugState.stroke.rendering.perStrokeData[artObjectId]
      if (strokeData) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        strokeData.pipelineStages.render.success = false
        strokeData.pipelineStages.render.error = errorMessage
        strokeData.pipelineStages.render.duration =
          performance.now() - renderStartTime
        strokeData.renderResult.success = false
        strokeData.renderResult.error = errorMessage

        // frameStatsが未更新の場合のみ増加（ドキュメントストロークの場合は既に更新済み）
        if (strokeType === 'preview') {
          debugState.stroke.rendering.frameStats.failedStrokes++
        }
      }

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
    // 重要: currentTempStrokeIdがnullの場合は新しいIDを生成しない
    if (!this.currentTempStrokeId) {
      debugState.webgpuEngine.renderPreviewStrokeSkipped = {
        reason: 'No currentTempStrokeId',
        hasCurrentStroke: !!currentStroke,
        pointCount: currentStroke?.points?.length || 0,
        timestamp: Date.now(),
      }
      return
    }
    const tempStrokeId = this.currentTempStrokeId

    // デバッグ: プレビューストロークのレンダリング状況を記録
    debugState.webgpuEngine.renderingPreviewStroke = {
      tempStrokeId,
      currentTempStrokeId: this.currentTempStrokeId,
      pointCount: currentStroke.points.length,
      isDrawing: this.state.isDrawing,
      width: this.state.strokeSettings.width,
      brushTexture: this.state.strokeSettings.brushSettings?.texture,
      scatterCount:
        this.state.strokeSettings.brushSettings?.scatterConfig?.count,
      timestamp: Date.now(),
    }

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
      // ランダム要素を追加して一意性を確保
      const randomPart = Math.random().toString(36).substring(2, 9)
      return `temp-stroke-${Date.now()}-${randomPart}`
    }

    const firstPoint = path.points[0]
    // 座標を整数化して一意性を保つ
    const x = Math.floor(firstPoint.x * 1000)
    const y = Math.floor(firstPoint.y * 1000)
    // timestampは現在のストロークが始まった時点の時刻を使用
    const timestamp = Date.now()
    // ランダムな文字列を追加して絶対的な一意性を保証
    const randomPart = Math.random().toString(36).substring(2, 9)

    return `temp-stroke-${x}-${y}-${timestamp}-${randomPart}`
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
            this.currentRenderDebugInfo?.renderedObjects.push(renderedObject)
          }
        })
      }

      this.currentRenderDebugInfo?.layerInfo.push(layerInfo)
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
    _renderPass: GPURenderPassEncoder,
    _documentContext: DocumentContext,
    _buffersToDestroy: GPUBuffer[],
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
    if (!this.device) throw new EngineError(ErrorCode.WebGPUDeviceNotAvailable)

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
    if (!this.device) throw new EngineError(ErrorCode.WebGPUDeviceNotAvailable)

    try {
      const width = texture.width
      const height = texture.height
      const bytesPerPixel = 4 // RGBA

      // テクスチャ情報をdebugStateに記録

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

      return imageData
    } catch (error) {
      console.error('Failed to read texture as ImageData:', error)
      return null
    }
  }

  /**
   * 領域レンダリング結果をImageDataとして取得
   * @param region ワールド座標での領域
   * @param outputWidth 出力幅（デフォルト：region.width）
   * @param outputHeight 出力高さ（デフォルト：region.height）
   * @returns ImageDataまたはnull
   */
  public async renderRegionToImageData(
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
      return imageData
    } finally {
      // テクスチャリソースをクリーンアップ
      texture.destroy()
    }
  }

  /**
   * 効率的な部分レンダリング（オフスクリーンテクスチャ使用）
   * @param region ワールド座標での領域
   * @param outputWidth 出力テクスチャの幅（デフォルト：region.width）
   * @param outputHeight 出力テクスチャの高さ（デフォルト：region.height）
   * @returns レンダリング結果テクスチャ
   */
  protected async renderRegionToTexture(
    region: { x: number; y: number; width: number; height: number },
    outputWidth?: number,
    outputHeight?: number,
    providedDocumentContext?: DocumentContext,
  ): Promise<GPUTexture | null> {
    if (!this.device) throw new EngineError(ErrorCode.WebGPUDeviceNotAvailable)

    // 無限再帰防止チェック
    const callKey = `${region.x},${region.y},${region.width},${region.height}`
    if (!this.renderCallCount) this.renderCallCount = new Map()
    const currentCount = this.renderCallCount.get(callKey) || 0
    if (currentCount > 5) {
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
    } else {
    }

    // layerNodesが存在するか確認
    if (documentContext.document.layerNodes) {
      if (documentContext.document.layerNodes.length === 0) {
        console.error('[PNG Export Debug] layerNodes is empty!')
      }
    } else {
      console.error('[PNG Export Debug] No layerNodes property in document!')
    }

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
    await this.device.queue.onSubmittedWorkDone()

    // エクスポート用カメラの準備
    const originalCamera: Camera2D | null = null

    try {
      // アートボード境界内のコンテンツ範囲を計算（アートボード外のオブジェクトは無視）
      const actualContentBounds = {
        left: region.x,
        top: region.y,
        right: region.x + region.width,
        bottom: region.y + region.height,
      }

      let _hasContent = false

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
              _hasContent = true
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

      const adjustedCenterX = centerX
      const adjustedCenterY = centerY

      // debugStateにカメラ情報を記録

      // エクスポート用の一時的なカメラを作成
      const originalCamera = this.camera
      const exportCamera = originalCamera.clone() // カメラのクローンを作成
      exportCamera.setPosition(adjustedCenterX, adjustedCenterY)
      exportCamera.setZoom(newZoom)

      // 一時的にエクスポート用カメラを使用
      this.camera = exportCamera

      // カメラ行列の確認

      // レンダリング対象の確認
      const artObjectCount = Object.keys(
        documentContext.document.artObjects,
      ).length
      debugState.stroke.document.artObjectCount = artObjectCount

      // renderRegion実行前のベースライン確認
      const baselineBuffer = this.device.createBuffer({
        size: 16, // 1ピクセル分
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      const baselineEncoder = this.device.createCommandEncoder({
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
      this.device.queue.submit([baselineEncoder.finish()])

      await this.device.queue.onSubmittedWorkDone()
      await baselineBuffer.mapAsync(GPUMapMode.READ)
      const baselineData = new Uint8Array(baselineBuffer.getMappedRange())

      const _baselinePixel = {
        r: baselineData[0],
        g: baselineData[1],
        b: baselineData[2],
        a: baselineData[3],
      }

      baselineBuffer.unmap()
      baselineBuffer.destroy()

      // ビューポート領域を指定してレンダリング
      // 実際のアートボードレンダリングを実行

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

      // 仮説15テスト: renderRegion後のシェーダー実行結果を確認
      const postRenderBuffer = this.device.createBuffer({
        size: 16, // 1ピクセル分
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      const postRenderEncoder = this.device.createCommandEncoder({
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
      this.device.queue.submit([postRenderEncoder.finish()])

      await this.device.queue.onSubmittedWorkDone()
      await postRenderBuffer.mapAsync(GPUMapMode.READ)
      const postRenderData = new Uint8Array(postRenderBuffer.getMappedRange())

      const _postRenderPixel = {
        r: postRenderData[0],
        g: postRenderData[1],
        b: postRenderData[2],
        a: postRenderData[3],
      }

      postRenderBuffer.unmap()
      postRenderBuffer.destroy()

      // 実際のレンダリング結果に焦点を当てる

      // 仮説4テスト: canvasTextureをチェック（Fill/Strokeが間違ったテクスチャに描画している可能性）

      // canvasTextureから中央部をサンプリング
      const sampleCenterX = Math.floor(textureWidth / 2)
      const sampleCenterY = Math.floor(textureHeight / 2)

      const canvasBuffer = this.device.createBuffer({
        size: 64, // 16ピクセル分 (4 bytes per pixel)
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      const canvasEncoder = this.device.createCommandEncoder({
        label: 'SampleCanvasTexture',
      })

      canvasEncoder.copyTextureToBuffer(
        {
          texture: this.context?.getCurrentTexture(),
          origin: { x: sampleCenterX - 8, y: sampleCenterY, z: 0 },
        },
        { buffer: canvasBuffer, bytesPerRow: 256 },
        { width: 16, height: 1, depthOrArrayLayers: 1 },
      )
      this.device.queue.submit([canvasEncoder.finish()])

      await this.device.queue.onSubmittedWorkDone()
      await canvasBuffer.mapAsync(GPUMapMode.READ)
      const _canvasData = new Uint8Array(canvasBuffer.getMappedRange())

      canvasBuffer.unmap()
      canvasBuffer.destroy()

      // renderTextureサンプリング
      const renderBuffer = this.device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      })

      const renderEncoder = this.device.createCommandEncoder({
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
      this.device.queue.submit([renderEncoder.finish()])

      await this.device.queue.onSubmittedWorkDone()
      await renderBuffer.mapAsync(GPUMapMode.READ)
      const _renderData = new Uint8Array(renderBuffer.getMappedRange())

      renderBuffer.unmap()
      renderBuffer.destroy()

      // レンダリング完了を確実に待つ
      if (this.device) {
        await this.device.queue.onSubmittedWorkDone()
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
   * キャンバス座標をワールド座標に変換（カメラ考慮版）
   */
  public canvasToWorld(canvasX: number, canvasY: number): Vector2 {
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
  public worldToCanvas(worldX: number, worldY: number): Vector2 {
    const canvasSize = this.getLogicalCanvasSize()
    return this.camera.worldToScreen(
      worldX,
      worldY,
      canvasSize.width,
      canvasSize.height,
    )
  }
}

/** document.artObjectsの変更を追跡する関数 */
export function trackDocumentChange(action: string, document: any) {
  const currentIds = Object.keys(document.artObjects)
  const lastChange =
    debugState.stroke.documentChanges.changeHistory[
      debugState.stroke.documentChanges.changeHistory.length - 1
    ]

  const before = {
    artObjectCount: lastChange?.after?.artObjectCount || 0,
    artObjectIds: lastChange?.after?.artObjectIds || [],
  }

  const after = {
    artObjectCount: currentIds.length,
    artObjectIds: [...currentIds],
  }

  const change = {
    timestamp: performance.now(),
    action,
    before,
    after,
    stackTrace: new Error().stack || 'no stack available',
  }

  debugState.stroke.documentChanges.changeHistory.push(change)
  debugState.stroke.documentChanges.lastChangeTime = change.timestamp

  // 履歴は最新20件のみ保持
  if (debugState.stroke.documentChanges.changeHistory.length > 20) {
    debugState.stroke.documentChanges.changeHistory.shift()
  }
}
