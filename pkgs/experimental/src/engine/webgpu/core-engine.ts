import {
  engineState,
  setWebGPUDevice,
  updatePerformanceMetrics,
  VectorPath,
  Vector2,
} from '../state'
import { debugLogger } from '../../utils/debug-logger'
import { StrokeRenderer } from './appearances/stroke-renderer'
import { FillRenderer } from './appearances/fill-renderer'
import { isFillAppearance, isStrokeAppearance } from '../document/appearance'
import { ArtObject } from '../document/art-object'
import { LayerNode } from '../document/layer'
import { Camera2D } from '../camera/camera-2d'
import {
  IAppearanceProcessor,
  BoundingBox,
} from './interfaces/IAppearanceProcessor'
import { LayerCompositor } from './compositing/layer-compositor'
import { OffscreenTexturePool } from './compositing/offscreen-texture-pool'

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

  // オフスクリーン合成用の追加プロパティ
  private layerCompositor: LayerCompositor | null = null
  private offscreenTexturePool: OffscreenTexturePool | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.camera = new Camera2D()
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
      this.device.addEventListener('uncapturederror', async (event: any) => {
        console.error('WebGPU uncaptured error:', event)
      })

      this.device.lost.then(async (info: any) => {
        console.error('WebGPU device lost:', info)
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
      this.createUniformBuffer()

      // ストロークレンダラーを初期化
      this.strokeRenderer = new StrokeRenderer(this.device)
      await this.strokeRenderer.initialize()

      // フィルレンダラーを初期化
      this.fillRenderer = new FillRenderer(this.device)
      await this.fillRenderer.initialize()

      // オフスクリーン合成システムを初期化
      this.offscreenTexturePool = new OffscreenTexturePool(this.device)
      this.layerCompositor = new LayerCompositor(
        this.device,
        this.offscreenTexturePool,
      )
      await this.layerCompositor.initialize()

      setWebGPUDevice(this.device, this.context)

      // テストドキュメントをロード

      // カメラをテストデータに合わせて調整
      this.camera.setPosition(400, 300)
      this.camera.setZoom(1.0)

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
    if (!this.device || path.points.length < 2) {
      return null
    }

    const vertices: number[] = []

    // 連続する線分として描画
    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i]
      const p2 = path.points[i + 1]

      const opacity = path.color.a * layerOpacity

      // カメラ変換を適用した座標に変換
      const transformedP1 = this.camera.worldToScreen(
        p1.x,
        p1.y,
        this.canvas.width,
        this.canvas.height,
      )
      const transformedP2 = this.camera.worldToScreen(
        p2.x,
        p2.y,
        this.canvas.width,
        this.canvas.height,
      )

      // NDC座標に変換 (-1 to 1)
      const ndcP1 = {
        x: (transformedP1.x / this.canvas.width) * 2 - 1,
        y: -((transformedP1.y / this.canvas.height) * 2 - 1),
      }
      const ndcP2 = {
        x: (transformedP2.x / this.canvas.width) * 2 - 1,
        y: -((transformedP2.y / this.canvas.height) * 2 - 1),
      }

      // 線分の始点
      vertices.push(
        ndcP1.x,
        ndcP1.y,
        path.color.r,
        path.color.g,
        path.color.b,
        opacity,
      )

      // 線分の終点
      vertices.push(
        ndcP2.x,
        ndcP2.y,
        path.color.r,
        path.color.g,
        path.color.b,
        opacity,
      )
    }

    if (vertices.length === 0) {
      return null
    }

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

    // 階層化されたレイヤーノードを修正されたオフスクリーン合成で処理
    const sortedLayerNodes = [...document.layerNodes].sort(
      (a, b) => a.order - b.order,
    )

    for (const layerNode of sortedLayerNodes) {
      await this.processLayerWithOffscreenCompositing(
        renderPass,
        document,
        layerNode,
        viewMatrix,
        canvasSize,
      )
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
    const layer = document.layers[layerNode.layerId]
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
        const artObject = document.artObjects[artObjectId]
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
                const { buffers, bounds } = await this.fillRenderer.render(
                  renderPass, // renderPass
                  vectorPath, // path
                  appearance, // appearance
                  this.camera.getProjectionMatrix(
                    canvasSize.width,
                    canvasSize.height,
                  ), // projectionMatrix
                  this.camera.getViewMatrix(
                    canvasSize.width,
                    canvasSize.height,
                  ), // viewMatrix
                  canvasSize, // canvasSize
                  { x: 0, y: 0, width: 0, height: 0 }, // inputBounds: 空のバウンディングボックス
                )
                buffersToDestroy.push(...buffers)
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

  /**
   * 階層構造のレイヤーツリーをレンダリング
   */
  private async renderLayerTree(
    renderPass: GPURenderPassEncoder,
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    if (!engineState.document) {
      return
    }

    // ドキュメント構造のレイヤーノードを使用
    const rootNodes = engineState.document.layerNodes
      .filter((node) => node.parentId === null)
      .sort((a, b) => a.order - b.order)

    for (const node of rootNodes) {
      await this.renderLayerNodeRecursive(
        renderPass,
        node,
        buffersToDestroy,
        1.0,
      )
    }
  }

  /**
   * レイヤーノードを再帰的にレンダリング（階層構造対応）
   */
  private async renderLayerNodeRecursive(
    renderPass: GPURenderPassEncoder,
    node: any,
    buffersToDestroy: GPUBuffer[],
    inheritedOpacity: number,
  ): Promise<void> {
    if (!engineState.document) {
      return
    }

    const layer = engineState.document.layers[node.layerId]
    if (!layer || !layer.visible) {
      return
    }

    const layerOpacity = (layer.opacity || 1.0) * inheritedOpacity

    // グループレイヤーの場合は子レイヤーを処理
    if (layer.type === 'group') {
      const childNodes = engineState.document.layerNodes
        .filter((childNode) => childNode.parentId === layer.id)
        .sort((a, b) => a.order - b.order)

      for (const childNode of childNodes) {
        await this.renderLayerNodeRecursive(
          renderPass,
          childNode,
          buffersToDestroy,
          layerOpacity,
        )
      }
    } else {
      // ベクターレイヤーの場合はPathArtObjectを描画
      if (layer.type === 'vector' || !layer.type) {
        await this.renderDocumentVectorLayer(
          renderPass,
          layer,
          layerOpacity,
          buffersToDestroy,
        )
      }
    }
  }

  /**
   * 新しいドキュメント構造のベクターレイヤーを描画
   */
  private async renderDocumentVectorLayer(
    renderPass: GPURenderPassEncoder,
    layer: any,
    opacity: number,
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    if (!engineState.document) {
      return
    }

    // artObjectIds内のPathArtObjectをレンダリング
    if (layer.artObjectIds && layer.artObjectIds.length > 0) {
      for (const artObjectId of layer.artObjectIds) {
        const artObject = engineState.document.artObjects[artObjectId]
        if (!artObject || artObject.type !== 'path' || !artObject.visible) {
          continue
        }

        await this.renderPathArtObject(
          renderPass,
          artObject,
          opacity,
          buffersToDestroy,
        )
      }
    } else {
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
      id: artObject.id,
      points: artObject.path.points,
      color: { r: 0, g: 0, b: 0, a: 1 }, // デフォルト（appearanceで上書き）
      strokeWidth: 2, // デフォルト（appearanceで上書き）
      closed: artObject.path.closed || false,
    }

    // 各アピアランスを処理
    for (const appearance of artObject.appearances) {
      if (!appearance.enabled) continue

      try {
        if (isStrokeAppearance(appearance)) {
          if (this.strokeRenderer) {
            // StrokeRendererでストロークアピアランスをレンダリング
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
              this.camera.getProjectionMatrix(
                this.canvas.width,
                this.canvas.height,
              ),
              this.camera.getViewMatrix(this.canvas.width, this.canvas.height),
              { width: this.canvas.width, height: this.canvas.height },
              { x: 0, y: 0, width: 0, height: 0 },
            )
            buffersToDestroy.push(...buffers)
          }
        } else if (isFillAppearance(appearance) && this.fillRenderer) {
          // 塗りアピアランスをレンダリング
          const { buffers } = await this.fillRenderer.render(
            renderPass,
            vectorPath,
            {
              ...appearance,
              params: {
                ...appearance.params,
                opacity: appearance.params.opacity * layerOpacity,
              },
            },
            this.camera.getProjectionMatrix(
              this.canvas.width,
              this.canvas.height,
            ),
            this.camera.getViewMatrix(this.canvas.width, this.canvas.height),
            { width: this.canvas.width, height: this.canvas.height },
            { x: 0, y: 0, width: 0, height: 0 },
          )
          buffersToDestroy.push(...buffers)
        }
      } catch (error) {
        console.error(
          '[DEBUG] Error rendering PathArtObject appearance:',
          error,
        )
      }
    }
  }

  /**
   * オブジェクトのバウンディングボックスを計算（修正版：安全マージン付き）
   */
  private calculateObjectBounds(artObject: ArtObject): BoundingBox {
    if (artObject.type !== 'path') {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    const pathData = (artObject as any).path

    if (!pathData?.points || pathData.points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    let minX = Infinity,
      minY = Infinity
    let maxX = -Infinity,
      maxY = -Infinity

    for (const point of pathData.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }

    // Check for invalid values
    if (
      !isFinite(minX) ||
      !isFinite(minY) ||
      !isFinite(maxX) ||
      !isFinite(maxY)
    ) {
      console.error('Invalid bounds calculated - infinite values detected')
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    // ストローク幅 + 安全マージンを考慮してバウンディングボックスを拡張
    const strokeWidth = this.getMaxStrokeWidth(artObject.appearances)
    const strokePadding = strokeWidth / 2
    const SAFETY_MARGIN = 10 // オブジェクトレベルでの追加安全マージン
    const totalPadding = strokePadding + SAFETY_MARGIN

    const bounds = {
      x: minX - totalPadding,
      y: minY - totalPadding,
      width: maxX - minX + 2 * totalPadding,
      height: maxY - minY + 2 * totalPadding,
    }

    // Check for invalid final bounds
    if (
      bounds.width < 0 ||
      bounds.height < 0 ||
      !isFinite(bounds.width) ||
      !isFinite(bounds.height)
    ) {
      console.error('Invalid final bounds - negative or infinite dimensions')
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    return bounds
  }

  /**
   * レイヤーのバウンディングボックスを計算（修正版：適切なパディング付き）
   */
  private calculateLayerBounds(layer: any, document: any): BoundingBox {
    if (layer.type !== 'vector' || !layer.artObjectIds?.length) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    let minX = Infinity,
      minY = Infinity
    let maxX = -Infinity,
      maxY = -Infinity

    for (const artObjectId of layer.artObjectIds) {
      const artObject = document.artObjects[artObjectId]
      if (!artObject) continue

      const objectBounds = this.calculateObjectBounds(artObject)
      if (objectBounds.width > 0 && objectBounds.height > 0) {
        minX = Math.min(minX, objectBounds.x)
        minY = Math.min(minY, objectBounds.y)
        maxX = Math.max(maxX, objectBounds.x + objectBounds.width)
        maxY = Math.max(maxY, objectBounds.y + objectBounds.height)
      }
    }

    // 有効なバウンディングボックスが計算できない場合
    if (minX === Infinity) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    // 適切なパディングを追加してオフスクリーン描画での座標変換問題を回避
    const SAFETY_PADDING = 20 // ピクセル単位の安全マージン

    const bounds = {
      x: minX - SAFETY_PADDING,
      y: minY - SAFETY_PADDING,
      width: maxX - minX + 2 * SAFETY_PADDING,
      height: maxY - minY + 2 * SAFETY_PADDING,
    }

    return bounds
  }

  /**
   * パスのバウンディングボックスを計算
   */
  private calculatePathBounds(path: VectorPath): BoundingBox {
    if (!path.points || path.points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    let minX = Infinity,
      minY = Infinity
    let maxX = -Infinity,
      maxY = -Infinity

    for (const point of path.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }

    // Check for invalid values
    if (
      !isFinite(minX) ||
      !isFinite(minY) ||
      !isFinite(maxX) ||
      !isFinite(maxY)
    ) {
      console.error('Invalid path bounds calculated - infinite values detected')
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    // ストローク幅を考慮してバウンディングボックスを拡張
    const strokeWidth = path.strokeWidth || 1.0
    const padding = strokeWidth / 2

    const bounds = {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + strokeWidth,
      height: maxY - minY + strokeWidth,
    }

    // Check for invalid final bounds
    if (
      bounds.width < 0 ||
      bounds.height < 0 ||
      !isFinite(bounds.width) ||
      !isFinite(bounds.height)
    ) {
      console.error(
        'Invalid final path bounds - negative or infinite dimensions',
      )
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    return bounds
  }

  /**
   * アピアランスから最大ストローク幅を取得
   */
  private getMaxStrokeWidth(appearances: any[]): number {
    let maxWidth = 0
    for (const appearance of appearances) {
      if (appearance.effectId === 'stroke' && appearance.enabled) {
        const strokeWidth = appearance.params?.width || 0
        maxWidth = Math.max(maxWidth, strokeWidth)
      }
    }
    return maxWidth
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

    // 新しいドキュメント構造でレイヤーをレンダリング
    try {
      await this.renderLayerTree(renderPass, buffersToDestroy)
    } catch (error) {}

    // 現在描画中のストロークを描画（リアルタイムプレビュー）
    if (
      this.strokeRenderer &&
      engineState.tools.currentStroke &&
      engineState.tools.currentStroke.points.length >= 2
    ) {
      try {
        // StrokeAppearanceを生成
        const strokeAppearance = {
          uid: 'current-stroke-preview',
          enabled: true,
          effectId: 'stroke' as const,
          params: {
            width: engineState.brushConfig.size,
            color: engineState.brushConfig.color,
            style: 'solid' as const,
            dashPattern: [],
            lineCap: 'round' as const,
            lineJoin: 'round' as const,
            opacity: 1.0,
            blendMode: 'normal' as const,
          },
        }

        const { buffers } = await this.strokeRenderer.render(
          renderPass,
          engineState.tools.currentStroke,
          strokeAppearance,
          this.camera.getProjectionMatrix(
            this.canvas.width,
            this.canvas.height,
          ),
          this.camera.getViewMatrix(this.canvas.width, this.canvas.height),
          { width: this.canvas.width, height: this.canvas.height },
          { x: 0, y: 0, width: 0, height: 0 },
        )
        buffersToDestroy.push(...buffers)
        pathsRendered++
      } catch (error) {}
    }

    // ドキュメントのfill appearanceを持つアートオブジェクトを描画 - renderLayerTreeで処理済みのため無効化
    /*
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
    */

    // レイヤーのパスを描画 - 従来の線分描画（フォールバック）
    if (this.lineRenderPipeline) {
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
        } else {
        }
      } else {
      }
    }

    renderPass.end()
    this.device.queue.submit([commandEncoder.finish()])

    // 全ての描画コマンドがキューに送信された後でバッファを破棄
    buffersToDestroy.forEach((buffer) => buffer.destroy())

    const renderEndTime = performance.now()
    const renderDuration = renderEndTime - renderStartTime

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

  /**
   * カメラの状態を更新
   */
  updateCamera(x: number, y: number, zoom: number, rotation: number): void {
    this.camera.setPosition(x, y)
    this.camera.setZoom(zoom)
    this.camera.setRotation(rotation)
  }

  /**
   * リソースを解放
   */
  destroy(): void {
    this.layerCompositor?.destroy()
    this.offscreenTexturePool?.destroy()
    this.fillRenderer?.dispose()
    this.strokeRenderer?.destroy()
    this.uniformBuffer?.destroy()

    this.layerCompositor = null
    this.offscreenTexturePool = null
    this.fillRenderer = null
    this.strokeRenderer = null
    this.uniformBuffer = null
    this.bindGroup = null
    this.renderPipeline = null
    this.lineRenderPipeline = null
  }

  /**
   * オフスクリーン合成対応のレイヤー処理（修正版：安全な座標変換付き）
   */
  private async processLayerWithOffscreenCompositing(
    mainRenderPass: GPURenderPassEncoder,
    document: any,
    layerNode: LayerNode,
    viewMatrix: Float32Array,
    canvasSize: { width: number; height: number },
  ): Promise<void> {
    if (!this.layerCompositor || !this.offscreenTexturePool) {
      // フォールバック: 従来の処理
      const buffersToDestroy: GPUBuffer[] = []
      await this.processLayerNodeForFills(
        mainRenderPass,
        document,
        layerNode,
        viewMatrix,
        canvasSize,
        buffersToDestroy,
      )
      // バッファクリーンアップ
      for (const buffer of buffersToDestroy) {
        buffer.destroy()
      }
      return
    }

    const layer = document.layers[layerNode.layerId]
    if (!layer || !layer.visible) {
      return
    }

    // 修正されたバウンディングボックス計算を使用
    const layerBounds = this.calculateLayerBounds(layer, document)
    if (layerBounds.width <= 0 || layerBounds.height <= 0) {
      return
    }

    // オフスクリーンテクスチャにレイヤー内容を描画
    const offscreenTexture = await this.layerCompositor.renderLayerToOffscreen(
      layerBounds,
      async (layerRenderPass: GPURenderPassEncoder) => {
        // レイヤー内の全アートオブジェクトを描画
        await this.renderLayerContentsToRenderPass(
          layerRenderPass,
          layer,
          document,
          layerBounds,
          viewMatrix,
          canvasSize,
        )
      },
    )

    // オフスクリーンテクスチャをメインキャンバスに合成（レイヤー透明度適用）
    const layerOpacity = layer.opacity ?? 1.0
    const mainProjectionMatrix = this.camera.getProjectionMatrix(
      this.canvas.width,
      this.canvas.height,
    )
    const mainViewMatrix = this.camera.getViewMatrix(
      this.canvas.width,
      this.canvas.height,
    )

    await this.layerCompositor.compositeTextureToMain(
      mainRenderPass,
      offscreenTexture,
      layerBounds,
      layerOpacity,
      mainProjectionMatrix,
      mainViewMatrix,
    )

    // オフスクリーンテクスチャをプールに返却
    this.offscreenTexturePool.releaseTexture(offscreenTexture)
  }

  /**
   * オフスクリーン描画用の投影行列を作成（修正版：安全な座標変換）
   * レイヤーのバウンディングボックスに合わせて正射影行列を作成
   */
  private createOffscreenProjectionMatrix(
    layerBounds: BoundingBox,
  ): Float32Array {
    const width = layerBounds.width
    const height = layerBounds.height

    // バウンディングボックスが既に適切なパディングを含んでいることを確認

    // レイヤーバウンディングボックス用の正射影行列
    // WebGPUのNDC座標系に合わせる（Y軸上向きが正）
    const left = layerBounds.x
    const right = layerBounds.x + width
    const top = layerBounds.y + height // Y軸下向きなので、下端がtop
    const bottom = layerBounds.y // Y軸下向きなので、上端がbottom

    // 正射影行列を作成（WebGPU NDC座標系用）
    const matrix = new Float32Array([
      2 / (right - left),
      0,
      0,
      0,
      0,
      2 / (top - bottom),
      0,
      0,
      0,
      0,
      1,
      0,
      -(right + left) / (right - left),
      -(top + bottom) / (top - bottom),
      0,
      1,
    ])

    return matrix
  }

  /**
   * オフスクリーン描画用のビュー行列を作成（修正版）
   * カメラ変換を適用せず、レイヤー座標系をそのまま使用
   */
  private createOffscreenViewMatrix(layerBounds: BoundingBox): Float32Array {
    // オフスクリーン描画では、レイヤーのローカル座標系を使用するため
    // 単位行列を返す（変換なし）
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
  }

  /**
   * レイヤー内容をレンダーパスに描画（修正版：安全な座標変換付き）
   */
  private async renderLayerContentsToRenderPass(
    renderPass: GPURenderPassEncoder,
    layer: any,
    document: any,
    layerBounds: BoundingBox,
    viewMatrix: Float32Array,
    canvasSize: { width: number; height: number },
  ): Promise<void> {
    if (layer.type !== 'vector') {
      return
    }

    // 修正されたオフスクリーン描画用の座標変換を計算
    const offscreenProjectionMatrix =
      this.createOffscreenProjectionMatrix(layerBounds)
    const offscreenViewMatrix = this.createOffscreenViewMatrix(layerBounds)
    const offscreenCanvasSize = {
      width: Math.ceil(layerBounds.width),
      height: Math.ceil(layerBounds.height),
    }

    const vectorLayer = layer as any
    const artObjectIds = vectorLayer.artObjectIds || []

    for (const artObjectId of artObjectIds) {
      const artObject = document.artObjects[artObjectId]
      if (!artObject) {
        continue
      }

      // アートオブジェクトのappearanceを順次処理
      let currentBounds: BoundingBox = { x: 0, y: 0, width: 0, height: 0 }

      for (const appearance of artObject.appearances) {
        if (
          isFillAppearance(appearance) &&
          appearance.enabled &&
          this.fillRenderer
        ) {
          try {
            const vectorPath =
              await this.convertArtObjectToVectorPath(artObject)
            if (vectorPath) {
              const { buffers, bounds } = await this.fillRenderer.render(
                renderPass,
                vectorPath,
                appearance,
                offscreenProjectionMatrix, // 修正されたオフスクリーン専用の投影行列
                offscreenViewMatrix, // 修正されたオフスクリーン専用のビュー行列
                offscreenCanvasSize, // オフスクリーンテクスチャのサイズ
                currentBounds,
              )

              // バッファは即座に破棄（レンダーパス終了後）
              setTimeout(() => {
                for (const buffer of buffers) {
                  buffer.destroy()
                }
              }, 0)

              currentBounds = bounds
            }
          } catch (error) {
            console.error('Fill rendering error:', error)
          }
        }

        if (
          isStrokeAppearance(appearance) &&
          appearance.enabled &&
          this.strokeRenderer
        ) {
          try {
            const vectorPath =
              await this.convertArtObjectToVectorPath(artObject)
            if (vectorPath) {
              const { buffers, bounds } = await this.strokeRenderer.render(
                renderPass,
                vectorPath,
                appearance,
                offscreenProjectionMatrix, // 修正されたオフスクリーン座標変換
                offscreenViewMatrix,
                offscreenCanvasSize,
                currentBounds,
              )

              // バッファは即座に破棄（レンダーパス終了後）
              setTimeout(() => {
                for (const buffer of buffers) {
                  buffer.destroy()
                }
              }, 0)

              currentBounds = bounds
            }
          } catch (error) {
            console.error('Stroke rendering error:', error)
          }
        }
      }
    }
  }

  /**
   * 現在描画中のストロークをリアルタイムで描画する
   */
  async renderCurrentStroke(
    renderPass: GPURenderPassEncoder,
    currentStroke: VectorPath,
  ): Promise<void> {
    if (!this.strokeRenderer || currentStroke.points.length < 2) {
      return
    }

    try {
      const projectionMatrix = this.camera.getProjectionMatrix(
        this.canvas.width,
        this.canvas.height,
      )
      const viewMatrix = this.camera.getViewMatrix(
        this.canvas.width,
        this.canvas.height,
      )
      const canvasSize = {
        width: this.canvas.width,
        height: this.canvas.height,
      }

      // 現在描画中のストロークにストロークアピアランスを適用
      const { createStroke } = await import('../document/appearance')
      const strokeAppearance = createStroke({
        width: currentStroke.strokeWidth,
        color: currentStroke.color,
        style: 'solid',
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 1.0,
      })

      const emptyBounds = { x: 0, y: 0, width: 0, height: 0 }

      await this.strokeRenderer.render(
        renderPass,
        currentStroke,
        strokeAppearance,
        projectionMatrix,
        viewMatrix,
        canvasSize,
        emptyBounds,
      )
    } catch (error) {
      console.error('Error rendering current stroke:', error)
    }
  }

  /**
   * ストローク描画モードでの描画を処理する
   */
  async renderWithStrokeMode(): Promise<void> {
    // 通常の描画を実行
    await this.render()

    // 追加で現在描画中のストロークを描画
    const engineState = await import('../state')
    if (
      engineState.engineState.tools.currentStroke &&
      engineState.engineState.tools.isDrawing &&
      engineState.engineState.tools.activeTool === 'brush' &&
      this.device &&
      this.context
    ) {
      // レンダーパスを開始して現在のストロークを描画
      const commandEncoder = this.device.createCommandEncoder()
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.context.getCurrentTexture().createView(),
            loadOp: 'load', // 既存の内容を保持
            storeOp: 'store',
          },
        ],
      })

      await this.renderCurrentStroke(
        renderPass,
        engineState.engineState.tools.currentStroke,
      )

      renderPass.end()
      this.device.queue.submit([commandEncoder.finish()])
    }
  }
}
