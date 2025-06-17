/**
 * WebGPU UI Rendering System
 *
 * 統合UIレンダリングシステム：テキスト、アイコン、UI要素を効率的に描画
 */

import { debugLogger } from '../../../utils/debug-logger'

export interface TextStyle {
  fontSize: number
  fontFamily: string
  color: { r: number; g: number; b: number; a: number }
  bold?: boolean
  italic?: boolean
}

export interface UIRenderOptions {
  position: { x: number; y: number }
  size?: { width: number; height: number }
  opacity?: number
  zIndex?: number
  backgroundColor?: { r: number; g: number; b: number; a: number }
  borderColor?: { r: number; g: number; b: number; a: number }
  borderRadius?: number
  borderWidth?: number
  fillMode?: 'fill' | 'stroke' | 'both'
}

/**
 * WebGPU用統合UIレンダラー
 */
export class UIRenderer {
  private device: GPUDevice
  private textRenderer: TextRenderer | null = null
  private iconRenderer: IconRenderer | null = null
  private panelRenderer: PanelRenderer | null = null

  constructor(device: GPUDevice) {
    this.device = device
  }

  async initialize(): Promise<void> {
    try {
      debugLogger.debug('UIRenderer initialization started')

      // 各サブレンダラーを初期化
      this.textRenderer = new TextRenderer(this.device)
      await this.textRenderer.initialize()

      this.iconRenderer = new IconRenderer(this.device)
      await this.iconRenderer.initialize()

      this.panelRenderer = new PanelRenderer(this.device)
      await this.panelRenderer.initialize()

      debugLogger.debug('UIRenderer initialization completed')
    } catch (error) {
      debugLogger.error('UIRenderer initialization failed', { error })
      throw error
    }
  }

  /**
   * UIレイヤー全体をレンダリング
   */
  async renderUILayer(renderPass: GPURenderPassEncoder): Promise<GPUBuffer[]> {
    if (!this.textRenderer || !this.iconRenderer || !this.panelRenderer) {
      debugLogger.warn('UIRenderer not fully initialized')
      return []
    }

    const buffersToDestroy: GPUBuffer[] = []

    try {
      // 1. パネル・背景を描画
      const panelBuffers = await this.panelRenderer.render(renderPass)
      buffersToDestroy.push(...panelBuffers)

      // 2. アイコン・図形を描画
      await this.iconRenderer.render(renderPass)

      // 3. テキストを最前面に描画
      await this.textRenderer.render(renderPass)

      return buffersToDestroy
    } catch (error) {
      debugLogger.error('UILayer rendering failed', { error })
      return buffersToDestroy
    }
  }

  /**
   * テキストを描画
   */
  renderText(text: string, options: UIRenderOptions, style: TextStyle): void {
    this.textRenderer?.addText(text, options, style)
  }

  /**
   * アイコンを描画
   */
  renderIcon(iconName: string, options: UIRenderOptions): void {
    this.iconRenderer?.addIcon(iconName, options)
  }

  /**
   * パネル・背景を描画
   */
  renderPanel(options: UIRenderOptions): void {
    this.panelRenderer?.addPanel(options)
  }

  /**
   * フレーム開始時の準備
   */
  beginFrame(): void {
    this.textRenderer?.clearQueue()
    this.iconRenderer?.clearQueue()
    this.panelRenderer?.clearQueue()
  }

  dispose(): void {
    this.textRenderer?.dispose()
    this.iconRenderer?.dispose()
    this.panelRenderer?.dispose()
  }
}

/**
 * グリフアトラスを使用した高速テキストレンダラー
 */
class TextRenderer {
  private device: GPUDevice
  private renderPipeline: GPURenderPipeline | null = null
  private glyphAtlas: GPUTexture | null = null
  private textQueue: Array<{
    text: string
    options: UIRenderOptions
    style: TextStyle
  }> = []

  constructor(device: GPUDevice) {
    this.device = device
  }

  async initialize(): Promise<void> {
    await this.createGlyphAtlas()
    await this.createRenderPipeline()
  }

  private async createGlyphAtlas(): Promise<void> {
    // TODO: フォントのグリフをテクスチャアトラスに描画
    // 現在は仮実装
    this.glyphAtlas = this.device.createTexture({
      label: 'UITextRenderer-GlyphAtlas',
      size: { width: 512, height: 512 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })
  }

  private async createRenderPipeline(): Promise<void> {
    const shaderCode = `
      struct UIUniforms {
        screenSize: vec2f,
        time: f32,
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

        // 画面座標系で直接描画（NDC変換）
        let ndc = (input.position / uniforms.screenSize) * 2.0 - 1.0;
        output.position = vec4f(ndc.x, -ndc.y, 0.0, 1.0);
        output.texCoord = input.texCoord;

        return output;
      }

      @fragment
      fn fs_main(input: VertexOutput) -> @location(0) vec4f {
        let glyph = textureSample(glyphTexture, glyphSampler, input.texCoord);

        // グリフのアルファ値を使用してテキスト色を適用
        return vec4f(0.0, 0.0, 0.0, glyph.r); // 仮: 黒色テキスト
      }
    `

    const shaderModule = this.device.createShaderModule({
      label: 'UITextRenderer-ShaderModule',
      code: shaderCode,
    })

    this.renderPipeline = this.device.createRenderPipeline({
      label: 'UITextRenderer-RenderPipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
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
  }

  addText(text: string, options: UIRenderOptions, style: TextStyle): void {
    this.textQueue.push({ text, options, style })
  }

  async render(renderPass: GPURenderPassEncoder): Promise<void> {
    if (!this.renderPipeline || this.textQueue.length === 0) return

    // TODO: テキストキューを処理してグリフクアッドを生成・描画
    renderPass.setPipeline(this.renderPipeline)

    for (const item of this.textQueue) {
      // 各テキストアイテムを描画
      // 実装は後続で詳細化
    }
  }

  clearQueue(): void {
    this.textQueue.length = 0
  }

  dispose(): void {
    this.glyphAtlas?.destroy()
  }
}

/**
 * アイコン・図形レンダラー
 */
class IconRenderer {
  private device: GPUDevice
  private iconQueue: Array<{ iconName: string; options: UIRenderOptions }> = []

  constructor(device: GPUDevice) {
    this.device = device
  }

  async initialize(): Promise<void> {
    // TODO: アイコンテクスチャ・シェーダーの初期化
  }

  addIcon(iconName: string, options: UIRenderOptions): void {
    this.iconQueue.push({ iconName, options })
  }

  async render(renderPass: GPURenderPassEncoder): Promise<void> {
    // TODO: アイコン描画の実装
  }

  clearQueue(): void {
    this.iconQueue.length = 0
  }

  dispose(): void {
    // TODO: リソース解放
  }
}

/**
 * パネル・背景レンダラー
 */
class PanelRenderer {
  private device: GPUDevice
  private renderPipeline: GPURenderPipeline | null = null
  private uniformBuffer: GPUBuffer | null = null
  private bindGroup: GPUBindGroup | null = null
  private panelQueue: Array<UIRenderOptions> = []

  constructor(device: GPUDevice) {
    this.device = device
  }

  async initialize(): Promise<void> {
    await this.createRenderPipeline()
    this.createUniformBuffer()
  }

  private async createRenderPipeline(): Promise<void> {
    const shaderCode = `
      struct UIUniforms {
        screenSize: vec2f,
        time: f32,
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

        let ndc = (input.position / uniforms.screenSize) * 2.0 - 1.0;
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
      label: 'UIPanelRenderer-ShaderModule',
      code: shaderCode,
    })

    this.renderPipeline = this.device.createRenderPipeline({
      label: 'UIPanelRenderer-RenderPipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 6 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x4' },
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
  }

  private createUniformBuffer(): void {
    this.uniformBuffer = this.device.createBuffer({
      label: 'UIPanelRenderer-UniformBuffer',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.bindGroup = this.device.createBindGroup({
      label: 'UIPanelRenderer-BindGroup',
      layout: this.renderPipeline!.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    })
  }

  addPanel(options: UIRenderOptions): void {
    this.panelQueue.push(options)
  }

  async render(renderPass: GPURenderPassEncoder): Promise<GPUBuffer[]> {
    if (!this.renderPipeline || !this.bindGroup || this.panelQueue.length === 0)
      return []

    renderPass.setPipeline(this.renderPipeline)
    renderPass.setBindGroup(0, this.bindGroup)

    const screenSize = new Float32Array([800, 600, 0, 0])
    this.device.queue.writeBuffer(this.uniformBuffer!, 0, screenSize)

    const buffersToDestroy: GPUBuffer[] = []

    for (const panel of this.panelQueue) {
      const buffer = await this.renderSinglePanel(renderPass, panel)
      if (buffer) {
        buffersToDestroy.push(buffer)
      }
    }

    return buffersToDestroy
  }

  private async renderSinglePanel(
    renderPass: GPURenderPassEncoder,
    panel: UIRenderOptions,
  ): Promise<GPUBuffer> {
    const { position, size } = panel
    const actualSize = size || { width: 100, height: 30 }
    const color = panel.backgroundColor || { r: 0.8, g: 0.8, b: 0.8, a: 1.0 }

    const vertices = new Float32Array([
      position.x,
      position.y,
      color.r,
      color.g,
      color.b,
      color.a,
      position.x + actualSize.width,
      position.y,
      color.r,
      color.g,
      color.b,
      color.a,
      position.x,
      position.y + actualSize.height,
      color.r,
      color.g,
      color.b,
      color.a,

      position.x + actualSize.width,
      position.y,
      color.r,
      color.g,
      color.b,
      color.a,
      position.x + actualSize.width,
      position.y + actualSize.height,
      color.r,
      color.g,
      color.b,
      color.a,
      position.x,
      position.y + actualSize.height,
      color.r,
      color.g,
      color.b,
      color.a,
    ])

    const vertexBuffer = this.device.createBuffer({
      label:
        'UIPanelRenderer-VertexBuffer-' +
        Math.random().toString(36).substring(7),
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })

    this.device.queue.writeBuffer(vertexBuffer, 0, vertices)

    renderPass.setVertexBuffer(0, vertexBuffer)
    renderPass.draw(6)

    return vertexBuffer
  }

  clearQueue(): void {
    this.panelQueue.length = 0
  }

  dispose(): void {
    this.uniformBuffer?.destroy()
  }
}
