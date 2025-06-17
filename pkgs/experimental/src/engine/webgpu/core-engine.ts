import {
  engineState,
  setWebGPUDevice,
  updatePerformanceMetrics,
  VectorPath,
  Vector2,
} from '../state'
import { StrokeRenderer } from './appearances/stroke-renderer'
import { FillRenderer } from './appearances/fill-renderer'
import { isFillAppearance } from '../document/appearance'
import { ArtObject } from '../document/art-object'
import { LayerNode } from '../document/layer'
import { Camera2D } from './camera'

export class WebGPUEngine {
  private canvas: HTMLCanvasElement
  private device: GPUDevice | null = null
  private context: GPUCanvasContext | null = null
  private renderPipeline: GPURenderPipeline | null = null
  private lineRenderPipeline: GPURenderPipeline | null = null
  private strokeRenderer: StrokeRenderer | null = null
  private fillRenderer: FillRenderer | null = null
  private uniformBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private lastFrameTime = 0
  private frameCount = 0
  private fpsUpdateTime = 0
  private camera: Camera2D

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.camera = new Camera2D({
      width: canvas.width,
      height: canvas.height,
    })
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

      this.device = await adapter.requestDevice()

      // WebGPUエラーイベントリスナーを設定
      this.device.addEventListener('uncapturederror', async (event: any) => {})

      this.device.lost.then(async (info: any) => {})

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
      this.createUniformBuffer()

      // ブラシレンダラーを初期化（一時的にコメントアウト）
      // this.strokeRenderer = new StrokeRenderer(this.device)
      // await this.strokeRenderer.initialize()
      // await debugLogger.info('Brush renderer initialized')

      // フィルレンダラーを初期化
      this.fillRenderer = new FillRenderer(this.device)
      await this.fillRenderer.initialize()

      setWebGPUDevice(this.device, this.context)

      // テストドキュメントをロード

      // カメラをテストデータに合わせて調整
      this.camera.fitToRect({ x: 0, y: 0, width: 800, height: 600 })

      return true
    } catch (error) {
      return false
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

  private createUniformBuffer() {
    // 簡略化のため一時的に無効化
    return
  }

  private updateUniforms() {
    if (!this.device || !this.uniformBuffer) return

    const { viewport } = engineState

    // ビュー行列（カメラ変換）
    const viewMatrix = new Float32Array([
      viewport.zoom,
      0,
      0,
      0,
      0,
      viewport.zoom,
      0,
      0,
      0,
      0,
      1,
      0,
      -viewport.x * viewport.zoom,
      -viewport.y * viewport.zoom,
      0,
      1,
    ])

    // プロジェクション行列（正射影）
    const projectionMatrix = new Float32Array([
      2 / viewport.width,
      0,
      0,
      0,
      0,
      -2 / viewport.height,
      0,
      0,
      0,
      0,
      1,
      0,
      -1,
      1,
      0,
      1,
    ])

    const uniformData = new Float32Array(32)
    uniformData.set(viewMatrix, 0)
    uniformData.set(projectionMatrix, 16)

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)
  }

  private createVertexBufferForPath(
    path: VectorPath,
    layerOpacity: number = 1.0,
  ): any {
    if (!this.device || path.points.length < 2) return null

    const vertices: number[] = []

    // 連続する線分として描画
    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i]
      const p2 = path.points[i + 1]

      const opacity = path.color.a * layerOpacity

      // 線分の始点
      vertices.push(
        p1.x,
        p1.y,
        path.color.r,
        path.color.g,
        path.color.b,
        opacity,
      )

      // 線分の終点
      vertices.push(
        p2.x,
        p2.y,
        path.color.r,
        path.color.g,
        path.color.b,
        opacity,
      )
    }

    if (vertices.length === 0) return null

    const vertexBuffer = this.device.createBuffer({
      label: `VectorPath_${path.id}_VertexBuffer`,
      size: vertices.length * 4,
      usage: 0x20 | 0x08, // VERTEX (0x20) | COPY_DST (0x08)
    })

    this.device.queue.writeBuffer(vertexBuffer, 0, new Float32Array(vertices))
    return { buffer: vertexBuffer, vertexCount: vertices.length / 6 }
  }

  private async renderDocumentFills(
    renderPass: any,
    buffersToDestroy: GPUBuffer[],
  ): Promise<number> {
    if (!this.fillRenderer || !engineState.document) {
      return 0
    }

    const document = engineState.document

    // ビューマトリクス作成（簡易版）
    const viewMatrix = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])

    // 実際のキャンバスサイズ（DPR考慮済み）を使用
    const canvasSize = {
      width: this.canvas.width,
      height: this.canvas.height,
    }

    let totalRenderedPaths = 0

    // 階層化されたレイヤーノードを再帰的に処理
    for (const layerNode of document.layerNodes) {
      const renderedPaths = await this.processLayerNodeForFills(
        renderPass,
        document,
        layerNode,
        viewMatrix,
        canvasSize,
        buffersToDestroy,
      )
      totalRenderedPaths += renderedPaths
    }

    return totalRenderedPaths
  }

  private async processLayerNodeForFills(
    renderPass: any,
    document: any,
    layerNode: LayerNode,
    viewMatrix: Float32Array,
    canvasSize: { width: number; height: number },
    buffersToDestroy: GPUBuffer[],
  ): Promise<number> {
    const layer = document.layers.get(layerNode.layerId)
    if (!layer || !layer.visible) {
      return 0
    }

    let renderedPaths = 0

    // VectorLayerのみ処理
    if (layer.type === 'vector') {
      const vectorLayer = layer as any
      const artObjectIds = vectorLayer.artObjectIds || []

      // レイヤー内の全アートオブジェクトを処理
      for (const artObjectId of artObjectIds) {
        const artObject = document.artObjects.get(artObjectId)
        if (!artObject) {
          continue
        }

        // fill appearanceを持つアートオブジェクトを描画
        for (const appearance of artObject.appearances) {
          if (isFillAppearance(appearance) && appearance.enabled) {
            try {
              // アートオブジェクトのパスデータをVectorPathに変換
              const vectorPath =
                await this.convertArtObjectToVectorPath(artObject)

              if (vectorPath && this.fillRenderer) {
                const fillBuffers = await this.fillRenderer.renderPath(
                  renderPass, // renderPass
                  vectorPath, // path
                  appearance, // appearance
                  this.camera.getProjectionMatrix(), // projectionMatrix
                  this.camera.getViewMatrix(), // viewMatrix
                  canvasSize, // canvasSize
                )
                // FillRendererから返されるバッファを追加
                buffersToDestroy.push(...fillBuffers)
                renderedPaths++
              } else {
              }
            } catch (error) {}
          }
        }
      }
    }

    // GroupLayerの場合、子レイヤーを再帰的に処理
    if (layer.type === 'group') {
      for (const childLayerId of layer.childLayerIds) {
        const childLayerNode = document.layerNodes.find(
          (node: LayerNode) => node.layerId === childLayerId,
        )
        if (childLayerNode) {
          const childRenderedPaths = await this.processLayerNodeForFills(
            renderPass,
            document,
            childLayerNode,
            viewMatrix,
            canvasSize,
            buffersToDestroy,
          )
          renderedPaths += childRenderedPaths
        }
      }
    }

    return renderedPaths
  }

  /**
   * ArtObjectをVectorPathに変換（簡易版）
   */
  private async convertArtObjectToVectorPath(
    artObject: ArtObject,
  ): Promise<VectorPath | null> {
    try {
      if (artObject.type !== 'path') {
        return null
      }

      // ArtObjectのパスデータからVectorPathを作成
      const pathData = (artObject as any).path

      if (!pathData || !pathData.points || pathData.points.length === 0) {
        return null
      }

      const vectorPath = {
        id: artObject.id,
        points: pathData.points,
        color: { r: 1, g: 0, b: 0, a: 1 }, // デフォルト色（後でappearanceで上書き）
        strokeWidth: 1.0, // デフォルトストローク幅
        closed: pathData.closed || false,
      }

      return vectorPath
    } catch (error) {
      return null
    }
  }

  async render() {
    if (!this.device || !this.context || !this.renderPipeline) {
      return
    }

    const renderStartTime = performance.now()

    const now = performance.now()
    const deltaTime = now - this.lastFrameTime
    this.lastFrameTime = now
    this.frameCount++

    if (now - this.fpsUpdateTime >= 1000) {
      const fps = (this.frameCount * 1000) / (now - this.fpsUpdateTime)
      updatePerformanceMetrics(fps, deltaTime)
      this.frameCount = 0
      this.fpsUpdateTime = now
    }

    const commandEncoder = this.device.createCommandEncoder({
      label: 'VectorPaintRenderCommandEncoder',
    })
    const textureView = this.context.getCurrentTexture().createView({
      label: 'VectorPaintCanvasTextureView',
    })

    const renderPass = commandEncoder.beginRenderPass({
      label: 'VectorPaintMainRenderPass',
      colorAttachments: [
        {
          view: textureView,
          clearValue: {
            r: engineState.canvas.backgroundColor.r,
            g: engineState.canvas.backgroundColor.g,
            b: engineState.canvas.backgroundColor.b,
            a: engineState.canvas.backgroundColor.a,
          },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    })

    // renderPass.setPipeline(this.renderPipeline) - 最初にパイプラインを設定しない

    // バッファ管理変数を初期化
    const buffersToDestroy: GPUBuffer[] = []
    let pathsRendered = 0

    // 現在の状態をデバッグログに記録

    // レンダリング状態をログ

    // デバッグ情報

    // レイヤーのパスを描画 - ブラシレンダリングを使用
    if (this.strokeRenderer) {
      try {
        for (const layer of engineState.layers) {
          if (!layer.visible) continue

          for (const path of layer.paths) {
            if (path.points.length >= 2) {
              try {
                const strokeBuffers = await this.strokeRenderer.renderPath(
                  renderPass,
                  path,
                  engineState.brushConfig.size,
                  'pencil',
                )
                buffersToDestroy.push(...strokeBuffers)
                pathsRendered++
              } catch (error) {}
            }
          }
        }
      } catch (error) {}

      // 現在描画中のストロークを描画
      if (
        engineState.tools.currentStroke &&
        engineState.tools.currentStroke.points.length >= 2
      ) {
        try {
          const strokeBuffers = await this.strokeRenderer.renderPath(
            renderPass,
            engineState.tools.currentStroke,
            engineState.brushConfig.size,
            'pencil',
          )
          buffersToDestroy.push(...strokeBuffers)
          pathsRendered++
        } catch (error) {}
      }
    } else {
    }

    // ドキュメントのfill appearanceを持つアートオブジェクトを描画

    if (this.fillRenderer && engineState.document) {
      try {
        const fillPathsCount = await this.renderDocumentFills(
          renderPass,
          buffersToDestroy,
        )
        pathsRendered += fillPathsCount
      } catch (error) {}
    } else {
    }

    // レイヤーのパスを描画 - 従来の線分描画（フォールバック）
    if (this.lineRenderPipeline) {
      // && !this.strokeRenderer) {
      renderPass.setPipeline(this.lineRenderPipeline)

      for (const layer of engineState.layers) {
        for (const path of layer.paths) {
          const vertexData = this.createVertexBufferForPath(path, layer.opacity)
          if (vertexData && path.points.length >= 2) {
            renderPass.setVertexBuffer(0, vertexData.buffer)
            renderPass.draw(vertexData.vertexCount)
            buffersToDestroy.push(vertexData.buffer)
            pathsRendered++
          }
        }
      }

      // 現在描画中のストロークを描画
      if (
        engineState.tools.currentStroke &&
        engineState.tools.currentStroke.points.length >= 2
      ) {
        const vertexData = this.createVertexBufferForPath(
          engineState.tools.currentStroke,
          1.0,
        )
        if (vertexData) {
          renderPass.setVertexBuffer(0, vertexData.buffer)
          renderPass.draw(vertexData.vertexCount)
          buffersToDestroy.push(vertexData.buffer)
          pathsRendered++
        }
      }
    }

    renderPass.end()
    this.device.queue.submit([commandEncoder.finish()])

    // 全ての描画コマンドがキューに送信された後でバッファを破棄
    buffersToDestroy.forEach((buffer) => buffer.destroy())

    const renderEndTime = performance.now()
    const renderDuration = renderEndTime - renderStartTime

    // パフォーマンスとレンダリング結果をログ

    // デバッグ情報
    if (pathsRendered === 0) {
    }
  }

  resize(width: number, height: number) {
    if (!this.canvas) return

    const dpr = window.devicePixelRatio || 1
    this.canvas.width = width * dpr
    this.canvas.height = height * dpr
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`

    engineState.viewport.width = width
    engineState.viewport.height = height
  }

  screenToWorld(screenX: number, screenY: number): Vector2 {
    const rect = this.canvas.getBoundingClientRect()

    // 簡単な座標変換（-1.0 to 1.0の正規化座標系）
    const x = (screenX / rect.width) * 2 - 1
    const y = -((screenY / rect.height) * 2 - 1)

    return { x, y }
  }

  worldToScreen(worldX: number, worldY: number): Vector2 {
    const { viewport } = engineState
    return {
      x: (worldX - viewport.x) * viewport.zoom,
      y: (worldY - viewport.y) * viewport.zoom,
    }
  }

  destroy() {
    this.uniformBuffer?.destroy()
    this.device?.destroy()
  }
}
