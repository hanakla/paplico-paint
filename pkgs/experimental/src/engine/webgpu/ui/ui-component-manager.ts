import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils'
import type { Camera2D } from '../../camera/camera-2d'
import type { ArtObject } from '../../document/art-object'
import type { DocumentContext } from '../../document-manager'
import type { Vector2 } from '../../state'
import { VertexEditTool } from '../../tools/vertex-edit-tool'
import { debugState } from '../core-engine'
import type { IWebGPUUIComponent } from './IWebGPUUIComponent'
import {
  type ButtonUIElement,
  type PathUIElement,
  type SurfaceUIElement,
  type TextUIElement,
  UIBuilder,
  type UIElement,
} from './ui-elements'
import { VertexEditRenderer } from './vertex-edit-renderer'

/**
 * レイキャスト結果
 */
export interface RaycastHit {
  /** ヒットしたオブジェクト */
  artObject: ArtObject
  /** ヒット位置（ワールド座標） */
  worldPosition: Vector2
  /** ヒット位置（ローカル座標） */
  localPosition: Vector2
  /** ヒット距離（0.0 = 完全一致、1.0 = 境界） */
  distance: number
  /** レイヤーID */
  layerId: string
  /** オブジェクトのバウンディングボックス */
  boundingBox: { x: number; y: number; width: number; height: number }
}

/**
 * WebGPU UIコンポーネントを管理し、実際のWebGPUレンダリングを行うマネージャー
 */
export class UIComponentManager {
  private components: IWebGPUUIComponent[] = []
  private selectedObjects: Set<string> = new Set()
  private lastRaycastHits: RaycastHit[] = []
  private device: GPUDevice
  private vertexEditRenderer: VertexEditRenderer | null = null
  private vertexEditTool: VertexEditTool | null = null

  // WebGPUレンダリング用リソース
  private renderPipeline: GPURenderPipeline | null = null
  private textRenderPipeline: GPURenderPipeline | null = null
  private uniformBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private uniformValues: ReturnType<typeof makeStructuredView>['views'] | null =
    null

  // テキストレンダリング用
  private textCanvas: HTMLCanvasElement
  private textContext: CanvasRenderingContext2D
  private glyphAtlas: GPUTexture | null = null

  constructor(device: GPUDevice) {
    this.device = device

    // テキストレンダリング用のcanvasを初期化
    this.textCanvas = document.createElement('canvas')
    this.textContext = this.textCanvas.getContext('2d')!
  }

  /**
   * WebGPUリソースを初期化
   */
  async initialize(): Promise<void> {
    await this.createRenderPipelines()
    this.createUniformBuffer()
    await this.createGlyphAtlas()

    // 頂点編集レンダラーを初期化（WebGPUパイプラインエラー修正済み）
    try {
      this.vertexEditRenderer = new VertexEditRenderer(this.device)
      await this.vertexEditRenderer.initialize()

      // 頂点編集ツールを初期化
      this.vertexEditTool = new VertexEditTool()
      this.vertexEditRenderer.setVertexEditTool(this.vertexEditTool)
    } catch (error) {
      console.error('Failed to initialize vertex edit renderer:', error)
      this.vertexEditRenderer = null
      this.vertexEditTool = null
    }
  }

  /**
   * WebGPUレンダーパイプラインを作成
   */
  private async createRenderPipelines(): Promise<void> {
    // 基本レンダーパイプライン（surface、button用）
    const shaderCode = `
      struct UIUniforms {
        screenSize: vec2f,
        cameraPosition: vec2f,
        cameraZoom: f32,
        _padding: f32,
      }

      struct VertexInput {
        @location(0) position: vec2f,
        @location(1) color: vec4f,
      }

      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
      }

      @group(0) @binding(0) var<uniform> uniforms: UIUniforms;

      @vertex
      fn vs_main(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;

        // 座標変換: ワールド座標 -> スクリーン座標 -> NDC
        let worldPos = input.position;
        let screenPos = (worldPos - uniforms.cameraPosition) * uniforms.cameraZoom + uniforms.screenSize * 0.5;
        let ndc = (screenPos / uniforms.screenSize) * 2.0 - 1.0;

        output.position = vec4f(ndc.x, -ndc.y, 0.0, 1.0);
        output.color = input.color;
        return output;
      }

      @fragment
      fn fs_main(input: VertexOutput) -> @location(0) vec4f {
        return input.color;
      }
    `

    const shaderModule = this.device.createShaderModule({
      label: 'UIComponentManager-ShaderModule',
      code: shaderCode,
    })

    this.renderPipeline = this.device.createRenderPipeline({
      label: 'UIComponentManager-RenderPipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 6 * 4, // vec2 + vec4
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
              { shaderLocation: 1, offset: 8, format: 'float32x4' }, // color
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
      },
    })

    // テキストレンダーパイプライン
    const textShaderCode = `
      struct UIUniforms {
        screenSize: vec2f,
        cameraPosition: vec2f,
        cameraZoom: f32,
        _padding: f32,
      }

      struct VertexInput {
        @location(0) position: vec2f,
        @location(1) texCoord: vec2f,
      }

      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) texCoord: vec2f,
      }

      @group(0) @binding(0) var<uniform> uniforms: UIUniforms;
      @group(0) @binding(1) var glyphTexture: texture_2d<f32>;
      @group(0) @binding(2) var glyphSampler: sampler;

      @vertex
      fn vs_main(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;

        let worldPos = input.position;
        let screenPos = (worldPos - uniforms.cameraPosition) * uniforms.cameraZoom + uniforms.screenSize * 0.5;
        let ndc = (screenPos / uniforms.screenSize) * 2.0 - 1.0;

        output.position = vec4f(ndc.x, -ndc.y, 0.0, 1.0);
        output.texCoord = input.texCoord;
        return output;
      }

      @fragment
      fn fs_main(input: VertexOutput) -> @location(0) vec4f {
        let glyph = textureSample(glyphTexture, glyphSampler, input.texCoord);
        return glyph; // Canvas2Dで描画された色をそのまま使用
      }
    `

    const textShaderModule = this.device.createShaderModule({
      label: 'UIComponentManager-TextShaderModule',
      code: textShaderCode,
    })

    this.textRenderPipeline = this.device.createRenderPipeline({
      label: 'UIComponentManager-TextRenderPipeline',
      layout: 'auto',
      vertex: {
        module: textShaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 4 * 4, // vec2 + vec2
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' }, // position
              { shaderLocation: 1, offset: 8, format: 'float32x2' }, // texCoord
            ],
          },
        ],
      },
      fragment: {
        module: textShaderModule,
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
      },
    })
  }

  /**
   * ユニフォームバッファを作成
   */
  private createUniformBuffer(): void {
    // webgpu-utilsを使用してシェーダーコードから構造体定義を抽出
    const shaderCode = `
      struct UIUniforms {
        screenSize: vec2f,
        cameraPosition: vec2f,
        cameraZoom: f32,
        _padding: f32,
      }
    `

    try {
      const defs = makeShaderDataDefinitions(shaderCode)

      if (defs.structs?.UIUniforms) {
        this.uniformValues = makeStructuredView(defs.structs.UIUniforms)

        this.uniformBuffer = this.device.createBuffer({
          label: 'UIComponentManager-UniformBuffer',
          size: this.uniformValues.arrayBuffer.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
      } else {
        // fallbackとして手動でバッファを作成
        this.uniformBuffer = this.device.createBuffer({
          label: 'UIComponentManager-UniformBuffer',
          size: 32, // vec2 + vec2 + f32 + f32 (padding)
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        this.uniformValues = null
      }
    } catch (_error) {
      // エラー時は手動でバッファを作成
      this.uniformBuffer = this.device.createBuffer({
        label: 'UIComponentManager-UniformBuffer',
        size: 32, // vec2 + vec2 + f32 + f32 (padding)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
      this.uniformValues = null
    }

    this.bindGroup = this.device.createBindGroup({
      label: 'UIComponentManager-BindGroup',
      layout: this.renderPipeline?.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    })
  }

  /**
   * グリフアトラスを作成
   */
  private async createGlyphAtlas(): Promise<void> {
    this.glyphAtlas = this.device.createTexture({
      label: 'UIComponentManager-GlyphAtlas',
      size: { width: 512, height: 512 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })
  }

  /**
   * UIコンポーネントを削除
   */
  removeComponent(component: IWebGPUUIComponent): void {
    const index = this.components.indexOf(component)
    if (index >= 0) {
      this.components.splice(index, 1)
    }
  }

  /**
   * 全てのUIコンポーネントを実際のWebGPUでレンダリング
   */
  async renderAll(
    renderPass: GPURenderPassEncoder,
    documentContext: DocumentContext,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    const renderStartTime = performance.now()

    // debugStateを更新
    debugState.ui.componentCount = this.components.length
    debugState.ui.activeComponents = this.components.map(
      (c) => c.constructor.name,
    )

    if (!this.renderPipeline || !this.uniformBuffer || !this.bindGroup) {
      console.error('UIComponentManager missing required resources', {
        renderPipeline: !!this.renderPipeline,
        uniformBuffer: !!this.uniformBuffer,
        bindGroup: !!this.bindGroup,
      })
      debugState.ui.errorCount++
      debugState.ui.lastError = 'UIComponentManager missing required resources'
      return
    }

    // ユニフォームバッファに書き込み（webgpu-utilsまたは手動）
    if (this.uniformBuffer) {
      const cameraPos = camera.getPosition()
      const cameraZoom = camera.getZoom()

      if (this.uniformValues) {
        // webgpu-utilsを使用
        this.uniformValues.set({
          screenSize: [canvasSize.width, canvasSize.height],
          cameraPosition: [cameraPos.x, cameraPos.y],
          cameraZoom: cameraZoom,
          _padding: 0,
        })
        this.device.queue.writeBuffer(
          this.uniformBuffer,
          0,
          this.uniformValues.arrayBuffer,
        )
      } else {
        // 手動でFloat32Arrayを作成
        const uniformData = new Float32Array([
          canvasSize.width,
          canvasSize.height,
          cameraPos.x,
          cameraPos.y,
          cameraZoom,
          0,
          0,
          0, // padding
        ])
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)
      }
    }

    // UIBuilderを作成してUI要素を構築
    const uiBuilder = new UIBuilder()

    // 各UIコンポーネントからUI要素を生成
    await this.generateUIElements(
      uiBuilder,
      documentContext,
      camera,
      canvasSize,
    )

    // 構築されたUI要素を実際にWebGPUで描画
    const elements = uiBuilder.build()

    // debugStateにUI要素情報を更新
    debugState.ui.elementsGenerated = elements.length
    debugState.ui.elementsRendered = elements.filter((e) => e.visible).length

    await this.renderUIElements(
      renderPass,
      elements,
      camera,
      canvasSize,
      buffersToDestroy,
    )

    // 頂点編集レンダラーでレンダリング
    if (this.vertexEditRenderer && this.vertexEditTool) {
      // ドキュメントコンテキストを頂点編集ツールに設定
      this.vertexEditTool.setDocumentContext(documentContext)

      // 頂点編集レンダラーでレンダリング
      await this.vertexEditRenderer.render(
        renderPass,
        documentContext,
        camera,
        canvasSize,
        buffersToDestroy,
      )
    }

    // レンダリング時間を記録
    const renderDuration = performance.now() - renderStartTime
    debugState.ui.lastRenderTime = renderDuration
  }

  /**
   * 頂点編集ツールを有効/無効にする
   */
  setVertexEditEnabled(enabled: boolean): void {
    if (this.vertexEditTool) {
      this.vertexEditTool.options.showHandles = enabled
    }
  }

  /**
   * 頂点編集ツールでのマウスイベント処理
   */
  handleVertexEditMouseDown(
    worldPosition: Vector2,
    event: PointerEvent,
  ): boolean {
    return this.vertexEditTool?.onMouseDown(worldPosition, event) || false
  }

  handleVertexEditMouseMove(worldPosition: Vector2): boolean {
    return this.vertexEditTool?.onMouseMove(worldPosition) || false
  }

  handleVertexEditMouseUp(): void {
    this.vertexEditTool?.onMouseUp()
  }

  /**
   * 各UIコンポーネントからUI要素を生成
   */
  private async generateUIElements(
    uiBuilder: UIBuilder,
    documentContext: DocumentContext,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
  ): Promise<void> {
    // レイヤー別・座標系別にグループ化して描画順序を制御
    const backgroundWorldComponents = this.components.filter(
      (c) =>
        c.getCoordinateSystem() === 'world' &&
        c.getRenderLayer() === 'background',
    )
    const backgroundScreenComponents = this.components.filter(
      (c) =>
        c.getCoordinateSystem() === 'screen' &&
        c.getRenderLayer() === 'background',
    )
    const foregroundWorldComponents = this.components.filter(
      (c) =>
        c.getCoordinateSystem() === 'world' &&
        c.getRenderLayer() === 'foreground',
    )
    const foregroundScreenComponents = this.components.filter(
      (c) =>
        c.getCoordinateSystem() === 'screen' &&
        c.getRenderLayer() === 'foreground',
    )

    // 背景レイヤーのUI要素を先に生成
    for (const component of backgroundWorldComponents) {
      await this.generateFromComponent(
        component,
        uiBuilder,
        documentContext,
        camera,
        canvasSize,
      )
    }
    for (const component of backgroundScreenComponents) {
      await this.generateFromComponent(
        component,
        uiBuilder,
        documentContext,
        camera,
        canvasSize,
      )
    }

    // 選択状態とレイキャスト結果を反映したUI要素を生成
    this.generateSelectionUI(uiBuilder, documentContext)

    // 前景レイヤーのUI要素を後で生成
    for (const component of foregroundWorldComponents) {
      await this.generateFromComponent(
        component,
        uiBuilder,
        documentContext,
        camera,
        canvasSize,
      )
    }
    for (const component of foregroundScreenComponents) {
      await this.generateFromComponent(
        component,
        uiBuilder,
        documentContext,
        camera,
        canvasSize,
      )
    }
  }

  /**
   * 個別のUIコンポーネントからUI要素を生成
   */
  private async generateFromComponent(
    component: IWebGPUUIComponent,
    uiBuilder: UIBuilder,
    documentContext: DocumentContext,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
  ): Promise<void> {
    // コンポーネントがgenerateElementsメソッドを持つ場合は使用
    if (
      'generateElements' in component &&
      typeof component.generateElements === 'function'
    ) {
      ;(component as any).generateElements(
        documentContext,
        uiBuilder,
        camera,
        canvasSize,
      )
    }
  }

  /**
   * UI要素を実際のWebGPUで描画
   */
  private async renderUIElements(
    renderPass: GPURenderPassEncoder,
    elements: UIElement[],
    camera: Camera2D,
    canvasSize: { width: number; height: number },
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    if (elements.length === 0) {
      return
    }

    // Z-index順にソート（背景要素は負のZ-index、前景要素は正のZ-index）
    const sortedElements = elements.sort(
      (a, b) => (a.zIndex || 0) - (b.zIndex || 0),
    )

    for (const element of sortedElements) {
      if (!element.visible) {
        continue
      }

      // 描画順序に記録
      debugState.ui.drawOrder.push({
        type: 'ui-background', // これは実際の描画パスに基づいて動的に設定される
        elementId: element.id,
        elementType: element.type,
        zIndex: element.zIndex,
        timestamp: performance.now(),
        position: element.location,
        size: element.size,
      })

      try {
        switch (element.type) {
          case 'surface':
            await this.renderSurfaceElement(
              renderPass,
              element as SurfaceUIElement,
              camera,
              canvasSize,
              buffersToDestroy,
            )
            break
          case 'button':
            await this.renderButtonElement(
              renderPass,
              element as ButtonUIElement,
              camera,
              canvasSize,
              buffersToDestroy,
            )
            break
          case 'text':
            try {
              await this.renderTextElement(
                renderPass,
                element as TextUIElement,
                camera,
                canvasSize,
                buffersToDestroy,
              )
            } catch (error) {
              debugState.ui.errorCount++
              debugState.ui.lastError = `Text rendering failed for ${
                element.id
              }: ${String(error)}`
            }
            break
          case 'path':
            await this.renderPathElement(
              renderPass,
              element as PathUIElement,
              camera,
              canvasSize,
              buffersToDestroy,
            )
            break
          default:
        }
      } catch (error) {
        debugState.ui.errorCount++
        debugState.ui.lastError = `Element ${element.type}#${
          element.id
        } rendering failed: ${String(error)}`
      }
    }
  }

  /**
   * Surfaceエレメントを実際のWebGPUで描画
   */
  private async renderSurfaceElement(
    renderPass: GPURenderPassEncoder,
    element: SurfaceUIElement,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    const location = element.location || { x: 0, y: 0 }
    const size = element.size || { width: 100, height: 100 }
    const backgroundColor = element.backgroundColor
    const borderColor = element.borderColor
    const borderWidth = element.borderWidth || 0

    // 座標変換（position: 'screen' | 'local'に応じて）
    let worldPos = location
    if (element.position === 'screen') {
      // スクリーン座標の場合、カメラ逆変換を適用してワールド座標に変換
      const cameraPos = camera.getPosition()
      const zoom = camera.getZoom()
      worldPos = {
        x: (location.x - canvasSize.width * 0.5) / zoom + cameraPos.x,
        y: (location.y - canvasSize.height * 0.5) / zoom + cameraPos.y,
      }
    }

    // 背景を描画
    if (
      backgroundColor &&
      (element.fillMode === 'fill' || element.fillMode === 'both')
    ) {
      await this.renderRectangle(
        renderPass,
        worldPos,
        size,
        backgroundColor,
        buffersToDestroy,
      )
    }

    // 境界線を描画
    if (
      borderColor &&
      borderWidth > 0 &&
      (element.fillMode === 'stroke' || element.fillMode === 'both')
    ) {
      await this.renderRectangleBorder(
        renderPass,
        worldPos,
        size,
        borderColor,
        borderWidth,
        buffersToDestroy,
      )
    }
  }

  /**
   * Buttonエレメントを実際のWebGPUで描画
   */
  private async renderButtonElement(
    renderPass: GPURenderPassEncoder,
    element: ButtonUIElement,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    // ボタンの背景をSurfaceとして描画
    const surfaceElement: SurfaceUIElement = {
      ...element,
      type: 'surface',
      fillMode: 'both',
    }
    await this.renderSurfaceElement(
      renderPass,
      surfaceElement,
      camera,
      canvasSize,
      buffersToDestroy,
    )

    // ボタンのテキストを描画
    const textElement: TextUIElement = {
      id: `${element.id}-text`,
      type: 'text',
      text: element.text,
      position: element.position,
      location: element.location,
      zIndex: (element.zIndex || 0) + 1,
      fontSize: element.fontSize,
      fontFamily: element.fontFamily,
      color: element.textColor,
      bold: element.bold,
    }
    await this.renderTextElement(
      renderPass,
      textElement,
      camera,
      canvasSize,
      buffersToDestroy,
    )
  }

  /**
   * Textエレメントを実際のWebGPUで描画
   */
  private async renderTextElement(
    renderPass: GPURenderPassEncoder,
    element: TextUIElement,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    if (!this.textRenderPipeline || !element.text) {
      return
    }

    const location = element.location || { x: 0, y: 0 }
    const fontSize = element.fontSize || element.style?.fontSize || 16
    const color = element.color ||
      element.style?.color || { r: 1, g: 1, b: 1, a: 1 }

    // カメラのズーム率を取得して高解像度テキストテクスチャを生成
    const zoomScale = camera.getZoom()
    const textTexture = this.generateTextTexture(
      element.text,
      fontSize,
      color,
      zoomScale,
      element.backgroundColor,
      element.padding,
    )
    if (!textTexture) {
      return
    }

    // 座標変換
    let worldPos = location
    const cameraPos = camera.getPosition()
    const zoom = camera.getZoom()

    if (element.position === 'screen') {
      worldPos = {
        x: (location.x - canvasSize.width * 0.5) / zoom + cameraPos.x,
        y: (location.y - canvasSize.height * 0.5) / zoom + cameraPos.y,
      }
    }

    // ズームスケールに応じたテキストサイズ調整
    const resolutionScale = Math.max(1.0, Math.min(zoomScale, 4.0))
    const displayWidth = textTexture.width / resolutionScale
    const displayHeight = textTexture.height / resolutionScale

    // テキスト矩形の頂点データを作成 (position: vec2, texCoord: vec2)
    const vertices = new Float32Array([
      // 第1三角形
      worldPos.x,
      worldPos.y, // position (左上)
      0.0,
      0.0, // texCoord (左上)
      worldPos.x + displayWidth,
      worldPos.y, // position (右上)
      1.0,
      0.0, // texCoord (右上)
      worldPos.x,
      worldPos.y + displayHeight, // position (左下)
      0.0,
      1.0, // texCoord (左下)
      // 第2三角形
      worldPos.x + displayWidth,
      worldPos.y, // position (右上)
      1.0,
      0.0, // texCoord (右上)
      worldPos.x + displayWidth,
      worldPos.y + displayHeight, // position (右下)
      1.0,
      1.0, // texCoord (右下)
      worldPos.x,
      worldPos.y + displayHeight, // position (左下)
      0.0,
      1.0, // texCoord (左下)
    ])

    // 頂点バッファを作成
    const vertexBuffer = this.device.createBuffer({
      label: `TextElement-${element.id}`,
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    })
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices)
    vertexBuffer.unmap()

    // テキスト用バインドグループを作成
    const sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    })

    const textBindGroup = this.device.createBindGroup({
      layout: this.textRenderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: textTexture.texture.createView() },
        { binding: 2, resource: sampler },
      ],
    })

    try {
      // ユニフォームバッファを更新（webgpu-utilsまたは手動）
      if (this.uniformBuffer) {
        const cameraPos = camera.getPosition()
        const cameraZoom = camera.getZoom()

        if (this.uniformValues) {
          // webgpu-utilsを使用
          this.uniformValues.set({
            screenSize: [canvasSize.width, canvasSize.height],
            cameraPosition: [cameraPos.x, cameraPos.y],
            cameraZoom: cameraZoom,
            _padding: 0,
          })
          this.device.queue.writeBuffer(
            this.uniformBuffer,
            0,
            this.uniformValues.arrayBuffer,
          )
        } else {
          // 手動でFloat32Arrayを作成
          const uniformData = new Float32Array([
            canvasSize.width,
            canvasSize.height,
            cameraPos.x,
            cameraPos.y,
            cameraZoom,
            0,
            0,
            0, // padding
          ])
          this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData)
        }
      }

      // 描画

      // WebGPU描画呼び出しを記録
      debugState.ui.renderCalls.push({
        callType: 'setPipeline',
        pipelineType: 'text',
        elementId: element.id,
        timestamp: performance.now(),
      })
      renderPass.setPipeline(this.textRenderPipeline!)

      debugState.ui.renderCalls.push({
        callType: 'setVertexBuffer',
        pipelineType: 'text',
        elementId: element.id,
        timestamp: performance.now(),
      })
      renderPass.setVertexBuffer(0, vertexBuffer)

      debugState.ui.renderCalls.push({
        callType: 'setBindGroup',
        pipelineType: 'text',
        elementId: element.id,
        timestamp: performance.now(),
      })
      renderPass.setBindGroup(0, textBindGroup)

      debugState.ui.renderCalls.push({
        callType: 'draw',
        pipelineType: 'text',
        elementId: element.id,
        timestamp: performance.now(),
      })
      renderPass.draw(6)

      buffersToDestroy.push(vertexBuffer)
    } catch (error) {
      console.error('Error rendering text element:', error)
    }
  }

  /**
   * Pathエレメントを実際のWebGPUで描画
   */
  private async renderPathElement(
    renderPass: GPURenderPassEncoder,
    element: PathUIElement,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    const location = element.location || { x: 0, y: 0 }
    const strokeColor = element.strokeColor || { r: 0, g: 0, b: 0, a: 1 }
    const strokeWidth = element.strokeWidth || 2

    // 座標変換
    let worldPos = location
    if (element.position === 'screen') {
      const cameraPos = camera.getPosition()
      const zoom = camera.getZoom()
      worldPos = {
        x: (location.x - canvasSize.width * 0.5) / zoom + cameraPos.x,
        y: (location.y - canvasSize.height * 0.5) / zoom + cameraPos.y,
      }
    }

    // パスの各点を小さな円で描画
    for (const point of element.path.points) {
      const pointPos = { x: worldPos.x + point.x, y: worldPos.y + point.y }
      const pointSize = { width: strokeWidth * 2, height: strokeWidth * 2 }
      await this.renderRectangle(
        renderPass,
        { x: pointPos.x - strokeWidth, y: pointPos.y - strokeWidth },
        pointSize,
        strokeColor,
        buffersToDestroy,
      )
    }

    // パスの線分を矩形で描画（簡易版）
    for (let i = 0; i < element.path.points.length - 1; i++) {
      const p1 = element.path.points[i]
      const p2 = element.path.points[i + 1]

      const lineStart = { x: worldPos.x + p1.x, y: worldPos.y + p1.y }
      const lineEnd = { x: worldPos.x + p2.x, y: worldPos.y + p2.y }

      await this.renderLine(
        renderPass,
        lineStart,
        lineEnd,
        strokeColor,
        strokeWidth,
        buffersToDestroy,
      )
    }
  }

  /**
   * 矩形を描画するヘルパーメソッド
   */
  private async renderRectangle(
    renderPass: GPURenderPassEncoder,
    position: { x: number; y: number },
    size: { width: number; height: number },
    color: { r: number; g: number; b: number; a: number },
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    const vertices = new Float32Array([
      // 第1三角形
      position.x,
      position.y,
      color.r,
      color.g,
      color.b,
      color.a,
      position.x + size.width,
      position.y,
      color.r,
      color.g,
      color.b,
      color.a,
      position.x,
      position.y + size.height,
      color.r,
      color.g,
      color.b,
      color.a,
      // 第2三角形
      position.x + size.width,
      position.y,
      color.r,
      color.g,
      color.b,
      color.a,
      position.x + size.width,
      position.y + size.height,
      color.r,
      color.g,
      color.b,
      color.a,
      position.x,
      position.y + size.height,
      color.r,
      color.g,
      color.b,
      color.a,
    ])

    const vertexBuffer = this.device.createBuffer({
      label: 'Rectangle-VertexBuffer',
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    })
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices)
    vertexBuffer.unmap()

    renderPass.setPipeline(this.renderPipeline!)
    renderPass.setVertexBuffer(0, vertexBuffer)
    renderPass.setBindGroup(0, this.bindGroup!)
    renderPass.draw(6)

    buffersToDestroy.push(vertexBuffer)
  }

  /**
   * 矩形の境界線を描画するヘルパーメソッド
   */
  private async renderRectangleBorder(
    renderPass: GPURenderPassEncoder,
    position: { x: number; y: number },
    size: { width: number; height: number },
    color: { r: number; g: number; b: number; a: number },
    borderWidth: number,
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    // 4つの境界線を描画
    const lines = [
      // 上辺
      { start: position, end: { x: position.x + size.width, y: position.y } },
      // 右辺
      {
        start: { x: position.x + size.width, y: position.y },
        end: { x: position.x + size.width, y: position.y + size.height },
      },
      // 下辺
      {
        start: { x: position.x + size.width, y: position.y + size.height },
        end: { x: position.x, y: position.y + size.height },
      },
      // 左辺
      { start: { x: position.x, y: position.y + size.height }, end: position },
    ]

    for (const line of lines) {
      await this.renderLine(
        renderPass,
        line.start,
        line.end,
        color,
        borderWidth,
        buffersToDestroy,
      )
    }
  }

  /**
   * 線を描画するヘルパーメソッド
   */
  private async renderLine(
    renderPass: GPURenderPassEncoder,
    start: { x: number; y: number },
    end: { x: number; y: number },
    color: { r: number; g: number; b: number; a: number },
    width: number,
    buffersToDestroy: GPUBuffer[],
  ): Promise<void> {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.sqrt(dx * dx + dy * dy)

    if (length < 0.1) return // 線が短すぎる場合はスキップ

    // 線を矩形として描画
    const angle = Math.atan2(dy, dx)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const halfWidth = width / 2

    // 矩形の4つの頂点を計算
    const vertices = new Float32Array([
      // 第1三角形
      start.x - sin * halfWidth,
      start.y + cos * halfWidth,
      color.r,
      color.g,
      color.b,
      color.a,
      end.x - sin * halfWidth,
      end.y + cos * halfWidth,
      color.r,
      color.g,
      color.b,
      color.a,
      start.x + sin * halfWidth,
      start.y - cos * halfWidth,
      color.r,
      color.g,
      color.b,
      color.a,
      // 第2三角形
      end.x - sin * halfWidth,
      end.y + cos * halfWidth,
      color.r,
      color.g,
      color.b,
      color.a,
      end.x + sin * halfWidth,
      end.y - cos * halfWidth,
      color.r,
      color.g,
      color.b,
      color.a,
      start.x + sin * halfWidth,
      start.y - cos * halfWidth,
      color.r,
      color.g,
      color.b,
      color.a,
    ])

    const vertexBuffer = this.device.createBuffer({
      label: 'Line-VertexBuffer',
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    })
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices)
    vertexBuffer.unmap()

    renderPass.setPipeline(this.renderPipeline!)
    renderPass.setVertexBuffer(0, vertexBuffer)
    renderPass.setBindGroup(0, this.bindGroup!)
    renderPass.draw(6)

    buffersToDestroy.push(vertexBuffer)
  }

  /**
   * テキストテクスチャを生成（ズーム率に応じた高解像度対応・背景色対応）
   */
  private generateTextTexture(
    text: string,
    fontSize: number,
    color: { r: number; g: number; b: number; a: number },
    zoomScale?: number,
    backgroundColor?: { r: number; g: number; b: number; a: number },
    padding?: number,
  ): { texture: GPUTexture; width: number; height: number } | null {
    try {
      // ズーム率に応じた解像度スケール（最小1.0、最大4.0）
      const resolutionScale = Math.max(1.0, Math.min(zoomScale || 1.0, 4.0))
      const scaledFontSize = fontSize * resolutionScale
      const scaledPadding = (padding || 4) * resolutionScale

      const fontFamily = 'Arial, sans-serif'

      // 高解像度でテキストサイズを測定
      this.textContext.font = `${scaledFontSize}px ${fontFamily}`
      const metrics = this.textContext.measureText(text)
      const textWidth = Math.ceil(metrics.width)
      const textHeight = scaledFontSize
      const width = textWidth + scaledPadding * 2
      const height = textHeight + scaledPadding * 2

      // 高解像度Canvasサイズを設定
      this.textCanvas.width = width
      this.textCanvas.height = height

      // 背景をクリア
      this.textContext.clearRect(0, 0, width, height)

      // 高品質レンダリング設定
      this.textContext.imageSmoothingEnabled = true
      this.textContext.imageSmoothingQuality = 'high'

      // 背景色を描画（指定されている場合）
      if (backgroundColor && backgroundColor.a > 0) {
        this.textContext.fillStyle = `rgba(${Math.floor(
          backgroundColor.r * 255,
        )}, ${Math.floor(backgroundColor.g * 255)}, ${Math.floor(
          backgroundColor.b * 255,
        )}, ${backgroundColor.a})`
        this.textContext.fillRect(0, 0, width, height)
      }

      // 高解像度でテキストを描画
      this.textContext.font = `${scaledFontSize}px ${fontFamily}`
      this.textContext.fillStyle = `rgba(${Math.floor(
        color.r * 255,
      )}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}, ${
        color.a
      })`
      this.textContext.textAlign = 'left'
      this.textContext.textBaseline = 'top'
      this.textContext.fillText(text, scaledPadding, scaledPadding)

      // WebGPUテクスチャを作成
      const texture = this.device.createTexture({
        size: { width, height },
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST |
          GPUTextureUsage.RENDER_ATTACHMENT,
      })

      // Canvas内容をテクスチャにコピー
      this.device.queue.copyExternalImageToTexture(
        { source: this.textCanvas },
        { texture },
        { width, height },
      )

      return { texture, width, height }
    } catch (_error) {
      return null
    }
  }

  /**
   * 選択状態とレイキャスト結果を反映したUI要素を生成
   */
  private generateSelectionUI(
    uiBuilder: UIBuilder,
    documentContext: DocumentContext,
  ): void {
    const document = documentContext.document

    // 選択されたオブジェクトの境界線を描画
    for (const objectId of this.selectedObjects) {
      const artObject = document.artObjects[objectId]
      if (!artObject || !artObject.visible) continue

      this.generateSelectionBounds(uiBuilder, artObject, objectId)
    }

    // レイキャスト結果のハイライト表示
    for (const hit of this.lastRaycastHits) {
      if (!this.selectedObjects.has(hit.artObject.id)) {
        this.generateHoverHighlight(uiBuilder, hit)
      }
    }
  }

  /**
   * 選択されたオブジェクトの境界線UI要素を生成
   */
  private generateSelectionBounds(
    uiBuilder: UIBuilder,
    artObject: ArtObject,
    objectId: string,
  ): void {
    if (artObject.type !== 'path' || !artObject.path?.points?.length) return

    // パスの境界ボックスを計算
    const boundingBox = this.calculatePathBoundingBox(artObject.path.points)
    const padding = 10

    uiBuilder.surface({
      id: `selection-${objectId}`,
      position: 'local', // ワールド座標に追従
      location: {
        x: boundingBox.x - padding,
        y: boundingBox.y - padding,
      },
      size: {
        width: boundingBox.width + 2 * padding,
        height: boundingBox.height + 2 * padding,
      },
      zIndex: 1000, // 前面に描画
      borderColor: { r: 0.2, g: 0.6, b: 1.0, a: 1.0 }, // 青色の境界線
      borderWidth: 2,
      fillMode: 'stroke', // ストロークのみ
    })

    // 選択ハンドルを描画
    this.generateSelectionHandles(uiBuilder, boundingBox, objectId, padding)
  }

  /**
   * 選択ハンドルのUI要素を生成
   */
  private generateSelectionHandles(
    uiBuilder: UIBuilder,
    boundingBox: { x: number; y: number; width: number; height: number },
    objectId: string,
    padding: number,
  ): void {
    const handleSize = 8
    const halfHandle = handleSize / 2

    // 8つの選択ハンドル（四隅 + 辺の中点）
    const handles = [
      // 四隅
      {
        x: boundingBox.x - padding - halfHandle,
        y: boundingBox.y - padding - halfHandle,
        id: 'top-left',
      },
      {
        x: boundingBox.x + boundingBox.width + padding - halfHandle,
        y: boundingBox.y - padding - halfHandle,
        id: 'top-right',
      },
      {
        x: boundingBox.x - padding - halfHandle,
        y: boundingBox.y + boundingBox.height + padding - halfHandle,
        id: 'bottom-left',
      },
      {
        x: boundingBox.x + boundingBox.width + padding - halfHandle,
        y: boundingBox.y + boundingBox.height + padding - halfHandle,
        id: 'bottom-right',
      },
      // 辺の中点
      {
        x: boundingBox.x + boundingBox.width / 2 - halfHandle,
        y: boundingBox.y - padding - halfHandle,
        id: 'top-center',
      },
      {
        x: boundingBox.x + boundingBox.width / 2 - halfHandle,
        y: boundingBox.y + boundingBox.height + padding - halfHandle,
        id: 'bottom-center',
      },
      {
        x: boundingBox.x - padding - halfHandle,
        y: boundingBox.y + boundingBox.height / 2 - halfHandle,
        id: 'left-center',
      },
      {
        x: boundingBox.x + boundingBox.width + padding - halfHandle,
        y: boundingBox.y + boundingBox.height / 2 - halfHandle,
        id: 'right-center',
      },
    ]

    for (const handle of handles) {
      uiBuilder.surface({
        id: `selection-handle-${objectId}-${handle.id}`,
        position: 'local',
        location: { x: handle.x, y: handle.y },
        size: { width: handleSize, height: handleSize },
        zIndex: 1001, // 選択境界線より前面
        backgroundColor: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 }, // 白い背景
        borderColor: { r: 0.2, g: 0.6, b: 1.0, a: 1.0 }, // 青い境界線
        borderWidth: 1,
        fillMode: 'both',
      })
    }
  }

  /**
   * ホバー時のハイライトUI要素を生成
   */
  private generateHoverHighlight(uiBuilder: UIBuilder, hit: RaycastHit): void {
    const boundingBox = hit.boundingBox
    const padding = 5

    uiBuilder.surface({
      id: `hover-${hit.artObject.id}`,
      position: 'local',
      location: {
        x: boundingBox.x - padding,
        y: boundingBox.y - padding,
      },
      size: {
        width: boundingBox.width + 2 * padding,
        height: boundingBox.height + 2 * padding,
      },
      zIndex: 999, // 選択境界線より背面
      borderColor: { r: 0.8, g: 0.8, b: 0.8, a: 0.6 }, // 半透明のグレー
      borderWidth: 1,
      fillMode: 'stroke',
    })
  }

  /**
   * UIのクリックイベントを処理
   */
  handleClick(_x: number, _y: number): boolean {
    // TODO: UI要素のクリック判定を実装
    return false
  }

  /**
   * スクリーン座標からレイキャストを実行
   */
  raycast(
    screenX: number,
    screenY: number,
    documentContext: DocumentContext,
    camera: Camera2D,
    canvasSize: { width: number; height: number },
  ): RaycastHit[] {
    // スクリーン座標をワールド座標に変換
    const worldPos = camera.screenToWorld(
      screenX,
      screenY,
      canvasSize.width,
      canvasSize.height,
    )

    const hits: RaycastHit[] = []
    const document = documentContext.document

    // レイヤーを前面から順にテスト（描画順の逆順）
    const sortedLayerNodes = document.layerNodes
      .filter((node) => node.parentId === null)
      .sort((a, b) => b.order - a.order) // 前面から背面へ

    for (const layerNode of sortedLayerNodes) {
      const layer = document.layers[layerNode.layerId]
      if (!layer || !layer.visible) continue

      // ベクターレイヤーのアートオブジェクトをテスト
      if (layer.type === 'vector' && layer.artObjectIds) {
        const sortedArtObjects = [...layer.artObjectIds].reverse()

        for (const artObjectId of sortedArtObjects) {
          const artObject = document.artObjects[artObjectId]
          if (!artObject || !artObject.visible) continue

          const hit = this.testArtObjectRaycast(artObject, worldPos, layer.id)
          if (hit) {
            hits.push(hit)
          }
        }
      }
    }

    // 結果を距離順にソート
    hits.sort((a, b) => a.distance - b.distance)

    // レイキャスト結果をキャッシュ
    this.lastRaycastHits = hits

    return hits
  }

  /**
   * アートオブジェクトのレイキャストテスト
   */
  private testArtObjectRaycast(
    artObject: ArtObject,
    worldPos: Vector2,
    layerId: string,
  ): RaycastHit | null {
    if (artObject.type === 'path') {
      return this.testPathArtObjectRaycast(artObject as any, worldPos, layerId)
    } else if (artObject.type === 'canvas') {
      return this.testCanvasArtObjectRaycast(
        artObject as any,
        worldPos,
        layerId,
      )
    }

    return null
  }

  /**
   * PathArtObjectのレイキャストテスト
   */
  private testPathArtObjectRaycast(
    pathObject: ArtObject & { type: 'path' },
    worldPos: Vector2,
    layerId: string,
  ): RaycastHit | null {
    const path = pathObject.path
    if (!path?.points || path.points.length < 2) return null

    // パスの各線分に対して距離を計算
    let minDistance = Infinity
    let closestPoint: Vector2 | null = null
    const boundingBox = this.calculatePathBoundingBox(path.points)

    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i]
      const p2 = path.points[i + 1]

      const distance = this.pointToLineDistance(worldPos, p1, p2)
      if (distance < minDistance) {
        minDistance = distance
        closestPoint = this.closestPointOnLine(worldPos, p1, p2)
      }
    }

    // ストローク幅を考慮したヒット判定
    const maxStrokeWidth = this.getMaxStrokeWidth(pathObject.appearances || [])
    const hitTolerance = Math.max(maxStrokeWidth / 2, 5) // 最小5ピクセルの許容範囲

    if (minDistance <= hitTolerance && closestPoint) {
      const localPos = {
        x: worldPos.x - (pathObject.transform?.x || 0),
        y: worldPos.y - (pathObject.transform?.y || 0),
      }

      return {
        artObject: pathObject,
        worldPosition: worldPos,
        localPosition: localPos,
        distance: minDistance / hitTolerance,
        layerId: pathObject.layerId || layerId,
        boundingBox,
      }
    }

    return null
  }

  /**
   * CanvasArtObjectのレイキャストテスト
   */
  private testCanvasArtObjectRaycast(
    canvasObject: ArtObject & { type: 'canvas' },
    worldPos: Vector2,
    layerId: string,
  ): RaycastHit | null {
    const transform = canvasObject.transform
    const x1 = transform.x
    const y1 = transform.y
    const x2 = transform.x + canvasObject.width * (transform.scaleX || 1)
    const y2 = transform.y + canvasObject.height * (transform.scaleY || 1)

    // 矩形内部のヒットテスト
    if (
      worldPos.x >= x1 &&
      worldPos.x <= x2 &&
      worldPos.y >= y1 &&
      worldPos.y <= y2
    ) {
      const localPos = {
        x: (worldPos.x - x1) / (transform.scaleX || 1),
        y: (worldPos.y - y1) / (transform.scaleY || 1),
      }

      const boundingBox = {
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1,
      }

      return {
        artObject: canvasObject,
        worldPosition: worldPos,
        localPosition: localPos,
        distance: 0, // 完全ヒット
        layerId: canvasObject.layerId || layerId,
        boundingBox,
      }
    }

    return null
  }

  /**
   * 選択状態を更新
   */
  updateSelection(objectIds: string[]): void {
    this.selectedObjects = new Set(objectIds)
  }

  /**
   * 選択状態をクリア
   */
  clearSelection(): void {
    this.selectedObjects.clear()
    this.lastRaycastHits = []
  }

  /**
   * 最後のレイキャスト結果を取得
   */
  getLastRaycastHits(): RaycastHit[] {
    return [...this.lastRaycastHits]
  }

  /**
   * 選択されたオブジェクトIDsを取得
   */
  getSelectedObjectIds(): Set<string> {
    return new Set(this.selectedObjects)
  }

  /**
   * ユーティリティメソッド群
   */
  private pointToLineDistance(
    point: Vector2,
    lineStart: Vector2,
    lineEnd: Vector2,
  ): number {
    const A = point.x - lineStart.x
    const B = point.y - lineStart.y
    const C = lineEnd.x - lineStart.x
    const D = lineEnd.y - lineStart.y

    const dot = A * C + B * D
    const lenSq = C * C + D * D

    if (lenSq === 0) {
      return Math.sqrt(A * A + B * B)
    }

    const param = dot / lenSq

    let xx: number, yy: number

    if (param < 0) {
      xx = lineStart.x
      yy = lineStart.y
    } else if (param > 1) {
      xx = lineEnd.x
      yy = lineEnd.y
    } else {
      xx = lineStart.x + param * C
      yy = lineStart.y + param * D
    }

    const dx = point.x - xx
    const dy = point.y - yy

    return Math.sqrt(dx * dx + dy * dy)
  }

  private closestPointOnLine(
    point: Vector2,
    lineStart: Vector2,
    lineEnd: Vector2,
  ): Vector2 {
    const A = point.x - lineStart.x
    const B = point.y - lineStart.y
    const C = lineEnd.x - lineStart.x
    const D = lineEnd.y - lineStart.y

    const dot = A * C + B * D
    const lenSq = C * C + D * D

    if (lenSq === 0) {
      return { x: lineStart.x, y: lineStart.y }
    }

    let param = dot / lenSq
    param = Math.max(0, Math.min(1, param))

    return {
      x: lineStart.x + param * C,
      y: lineStart.y + param * D,
    }
  }

  private calculatePathBoundingBox(points: Vector2[]): {
    x: number
    y: number
    width: number
    height: number
  } {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity

    for (const point of points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  private getMaxStrokeWidth(appearances: any[]): number {
    let maxWidth = 0
    for (const appearance of appearances) {
      if (appearance.effectId === 'stroke' && appearance.enabled) {
        const strokeWidth = appearance.params?.width || 0
        maxWidth = Math.max(maxWidth, strokeWidth)
      }
    }
    return maxWidth || 1
  }

  /**
   * UIコンポーネントを追加
   */
  addComponent(component: IWebGPUUIComponent): void {
    this.components.push(component)
  }

  /**
   * 頂点編集ツールを取得
   */
  getVertexEditTool(): VertexEditTool | null {
    return this.vertexEditTool
  }

  /**
   * 全てのリソースを解放
   */
  destroy(): void {
    for (const component of this.components) {
      component.destroy()
    }
    this.components.length = 0
    this.selectedObjects.clear()
    this.lastRaycastHits = []

    // WebGPUリソースを解放
    this.glyphAtlas?.destroy()
    this.uniformBuffer?.destroy()
  }
}
