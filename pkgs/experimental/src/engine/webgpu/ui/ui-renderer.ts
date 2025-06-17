/**
 * WebGPU UI Rendering System
 *
 * 統合UIレンダリングシステム：宣言的UI・テキスト・アイコン・UI要素を効率的に描画
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

// 宣言的UI要素の基底型
export interface UIElement {
  id: string
  type: string
  position: { x: number; y: number }
  size?: { width: number; height: number }
  zIndex?: number
  visible?: boolean
  opacity?: number
  children?: UIElement[]
}

export interface TextUIElement extends UIElement {
  type: 'text'
  text: string
  style: TextStyle
}

export interface PanelUIElement extends UIElement {
  type: 'panel'
  backgroundColor?: { r: number; g: number; b: number; a: number }
  borderColor?: { r: number; g: number; b: number; a: number }
  borderRadius?: number
  borderWidth?: number
  fillMode?: 'fill' | 'stroke' | 'both'
}

export interface ButtonUIElement extends UIElement {
  type: 'button'
  text: string
  backgroundColor?: { r: number; g: number; b: number; a: number }
  borderColor?: { r: number; g: number; b: number; a: number }
  borderRadius?: number
  textStyle?: TextStyle
  onClick?: () => void
}

export interface IconUIElement extends UIElement {
  type: 'icon'
  iconName: string
  color?: { r: number; g: number; b: number; a: number }
}

export interface SelectionUIElement extends UIElement {
  type: 'selection'
  boundingBox: { x: number; y: number; width: number; height: number }
  showHandles?: boolean
  handleSize?: number
  strokeColor?: { r: number; g: number; b: number; a: number }
  fillColor?: { r: number; g: number; b: number; a: number }
}

export interface VertexUIElement extends UIElement {
  type: 'vertex'
  vertexType: 'anchor' | 'control1' | 'control2'
  selected?: boolean
  color?: { r: number; g: number; b: number; a: number }
  vertexSize?: number
}

export interface GridUIElement extends UIElement {
  type: 'grid'
  gridSize: number
  color?: { r: number; g: number; b: number; a: number }
  strokeWidth?: number
}

export type AnyUIElement =
  | TextUIElement
  | PanelUIElement
  | ButtonUIElement
  | IconUIElement
  | SelectionUIElement
  | VertexUIElement
  | GridUIElement

/**
 * 宣言的UIビルダー - ReactライクなAPI
 */
export class UIBuilder {
  private elements: UIElement[] = []

  /**
   * テキスト要素を追加
   */
  text(text: string, options: Partial<TextUIElement>): UIBuilder {
    const element: TextUIElement = {
      id: options.id || `text-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      text,
      position: options.position || { x: 0, y: 0 },
      size: options.size,
      zIndex: options.zIndex || 0,
      visible: options.visible !== false,
      opacity: options.opacity || 1.0,
      style: options.style || {
        fontSize: 16,
        fontFamily: 'Arial',
        color: { r: 0, g: 0, b: 0, a: 1 },
      },
      children: options.children || [],
    }
    this.elements.push(element)
    return this
  }

  /**
   * パネル要素を追加
   */
  panel(options: Partial<PanelUIElement>): UIBuilder {
    const element: PanelUIElement = {
      id: options.id || `panel-${Math.random().toString(36).substr(2, 9)}`,
      type: 'panel',
      position: options.position || { x: 0, y: 0 },
      size: options.size || { width: 100, height: 100 },
      zIndex: options.zIndex || 0,
      visible: options.visible !== false,
      opacity: options.opacity || 1.0,
      backgroundColor: options.backgroundColor || {
        r: 0.8,
        g: 0.8,
        b: 0.8,
        a: 1.0,
      },
      borderColor: options.borderColor,
      borderRadius: options.borderRadius || 0,
      borderWidth: options.borderWidth || 0,
      fillMode: options.fillMode || 'fill',
      children: options.children || [],
    }
    this.elements.push(element)
    return this
  }

  /**
   * ボタン要素を追加
   */
  button(
    text: string,
    onClick: () => void,
    options: Partial<ButtonUIElement> = {},
  ): UIBuilder {
    const element: ButtonUIElement = {
      id: options.id || `button-${Math.random().toString(36).substr(2, 9)}`,
      type: 'button',
      text,
      position: options.position || { x: 0, y: 0 },
      size: options.size || { width: 120, height: 40 },
      zIndex: options.zIndex || 0,
      visible: options.visible !== false,
      opacity: options.opacity || 1.0,
      backgroundColor: options.backgroundColor || {
        r: 0.7,
        g: 0.7,
        b: 0.9,
        a: 1.0,
      },
      borderColor: options.borderColor || { r: 0.5, g: 0.5, b: 0.7, a: 1.0 },
      borderRadius: options.borderRadius || 4,
      textStyle: options.textStyle || {
        fontSize: 14,
        fontFamily: 'Arial',
        color: { r: 0, g: 0, b: 0, a: 1 },
      },
      onClick,
      children: options.children || [],
    }
    this.elements.push(element)
    return this
  }

  /**
   * 選択ボックスを描画
   */
  selectionBox(
    boundingBox: { x: number; y: number; width: number; height: number },
    options: Partial<SelectionUIElement> = {},
  ): UIBuilder {
    const element: SelectionUIElement = {
      id: options.id || `selection-${Math.random().toString(36).substr(2, 9)}`,
      type: 'selection',
      position: { x: boundingBox.x, y: boundingBox.y },
      size: { width: boundingBox.width, height: boundingBox.height },
      zIndex: options.zIndex || 1000,
      visible: options.visible !== false,
      opacity: options.opacity || 1.0,
      boundingBox,
      showHandles: options.showHandles !== false,
      handleSize: options.handleSize || 8,
      strokeColor: options.strokeColor || { r: 0.2, g: 0.6, b: 1.0, a: 1.0 },
      fillColor: options.fillColor || { r: 0.2, g: 0.6, b: 1.0, a: 0.1 },
      children: options.children || [],
    }
    this.elements.push(element)
    return this
  }

  /**
   * 頂点を描画
   */
  vertex(
    position: { x: number; y: number },
    vertexType: 'anchor' | 'control1' | 'control2',
    options: Partial<VertexUIElement> = {},
  ): UIBuilder {
    const size = options.vertexSize || (vertexType === 'anchor' ? 6 : 4)
    const element: VertexUIElement = {
      id: options.id || `vertex-${Math.random().toString(36).substr(2, 9)}`,
      type: 'vertex',
      position,
      size: { width: size * 2, height: size * 2 },
      zIndex: options.zIndex || 1001,
      visible: options.visible !== false,
      opacity: options.opacity || 1.0,
      vertexType,
      selected: options.selected || false,
      color:
        options.color ||
        (vertexType === 'anchor'
          ? { r: 1, g: 1, b: 1, a: 1 }
          : { r: 0.8, g: 0.8, b: 0.8, a: 1 }),
      vertexSize: size,
      children: options.children || [],
    }
    this.elements.push(element)
    return this
  }

  /**
   * グリッドを描画
   */
  grid(
    gridSize: number,
    canvasSize: { width: number; height: number },
    options: Partial<GridUIElement> = {},
  ): UIBuilder {
    const element: GridUIElement = {
      id: options.id || `grid-${Math.random().toString(36).substr(2, 9)}`,
      type: 'grid',
      position: { x: 0, y: 0 },
      size: canvasSize,
      zIndex: options.zIndex || -1000,
      visible: options.visible !== false,
      opacity: options.opacity || 0.3,
      gridSize,
      color: options.color || { r: 0.7, g: 0.7, b: 0.7, a: 0.5 },
      strokeWidth: options.strokeWidth || 1,
      children: options.children || [],
    }
    this.elements.push(element)
    return this
  }

  /**
   * 構築したUI要素を取得
   */
  build(): UIElement[] {
    const result = [...this.elements]
    this.elements = [] // リセット
    return result
  }

  /**
   * 全要素をクリア
   */
  clear(): UIBuilder {
    this.elements = []
    return this
  }
}

/**
 * UIツリー管理システム
 */
export class UITree {
  private root: UIElement[] = []
  private elementMap = new Map<string, UIElement>()

  /**
   * UI要素を追加
   */
  addElement(element: UIElement): void {
    this.root.push(element)
    this.indexElement(element)
  }

  /**
   * UI要素を更新
   */
  updateElement(id: string, updates: Partial<UIElement>): boolean {
    const element = this.elementMap.get(id)
    if (!element) return false

    Object.assign(element, updates)
    return true
  }

  /**
   * UI要素を削除
   */
  removeElement(id: string): boolean {
    const element = this.elementMap.get(id)
    if (!element) return false

    this.root = this.root.filter((e) => e.id !== id)
    this.elementMap.delete(id)
    return true
  }

  /**
   * IDで要素を検索
   */
  getElementById(id: string): UIElement | null {
    return this.elementMap.get(id) || null
  }

  /**
   * 全要素を取得（Z-index順）
   */
  getAllElements(): UIElement[] {
    return this.flattenElements(this.root).sort(
      (a, b) => (a.zIndex || 0) - (b.zIndex || 0),
    )
  }

  /**
   * 座標からヒットテスト
   */
  hitTest(x: number, y: number): UIElement | null {
    const elements = this.getAllElements().reverse() // 最前面から検索

    for (const element of elements) {
      if (!element.visible) continue

      const pos = element.position
      const size = element.size || { width: 0, height: 0 }

      if (
        x >= pos.x &&
        x <= pos.x + size.width &&
        y >= pos.y &&
        y <= pos.y + size.height
      ) {
        return element
      }
    }

    return null
  }

  /**
   * ツリーをクリア
   */
  clear(): void {
    this.root = []
    this.elementMap.clear()
  }

  private indexElement(element: UIElement): void {
    this.elementMap.set(element.id, element)

    if (element.children) {
      for (const child of element.children) {
        this.indexElement(child)
      }
    }
  }

  private flattenElements(elements: UIElement[]): UIElement[] {
    const result: UIElement[] = []

    for (const element of elements) {
      result.push(element)
      if (element.children) {
        result.push(...this.flattenElements(element.children))
      }
    }

    return result
  }
}

/**
 * WebGPU用統合UIレンダラー（宣言的UI対応）
 */
export class UIRenderer {
  private device: GPUDevice
  private textRenderer: TextRenderer | null = null
  private iconRenderer: IconRenderer | null = null
  private panelRenderer: PanelRenderer | null = null
  private uiTree = new UITree()

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
   * 宣言的UIツリーを設定
   */
  setUITree(elements: UIElement[]): void {
    this.uiTree.clear()
    for (const element of elements) {
      this.uiTree.addElement(element)
    }
  }

  /**
   * UIビルダーから直接設定
   */
  setUI(builder: UIBuilder): void {
    this.setUITree(builder.build())
  }

  /**
   * UIレイヤー全体をレンダリング（宣言的UI対応）
   */
  async renderUILayer(renderPass: GPURenderPassEncoder): Promise<GPUBuffer[]> {
    if (!this.textRenderer || !this.iconRenderer || !this.panelRenderer) {
      debugLogger.warn('UIRenderer not fully initialized')
      return []
    }

    const buffersToDestroy: GPUBuffer[] = []

    try {
      // 宣言的UIツリーから描画コマンドを生成
      const elements = this.uiTree.getAllElements()

      for (const element of elements) {
        if (!element.visible) continue

        switch (element.type) {
          case 'panel':
            this.renderPanelElement(element as PanelUIElement)
            break
          case 'button':
            this.renderButtonElement(element as ButtonUIElement)
            break
          case 'text':
            this.renderTextElement(element as TextUIElement)
            break
          case 'icon':
            this.renderIconElement(element as IconUIElement)
            break
          case 'selection':
            this.renderSelectionElement(element as SelectionUIElement)
            break
          case 'vertex':
            this.renderVertexElement(element as VertexUIElement)
            break
          case 'grid':
            this.renderGridElement(element as GridUIElement)
            break
        }
      }

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
   * マウスクリックイベントを処理
   */
  handleClick(x: number, y: number): boolean {
    const hitElement = this.uiTree.hitTest(x, y)

    if (hitElement && hitElement.type === 'button') {
      const button = hitElement as ButtonUIElement
      if (button.onClick) {
        button.onClick()
        return true
      }
    }

    return false
  }

  /**
   * UI要素を動的に更新
   */
  updateElement(id: string, updates: Partial<UIElement>): boolean {
    return this.uiTree.updateElement(id, updates)
  }

  /**
   * UI要素を削除
   */
  removeElement(id: string): boolean {
    return this.uiTree.removeElement(id)
  }

  private renderPanelElement(element: PanelUIElement): void {
    const options: UIRenderOptions = {
      position: element.position,
      size: element.size,
      opacity: element.opacity,
      zIndex: element.zIndex,
      backgroundColor: element.backgroundColor,
      borderColor: element.borderColor,
      borderRadius: element.borderRadius,
      borderWidth: element.borderWidth,
      fillMode: element.fillMode,
    }
    this.panelRenderer?.addPanel(options)
  }

  private renderButtonElement(element: ButtonUIElement): void {
    // ボタンの背景パネルを描画
    const panelOptions: UIRenderOptions = {
      position: element.position,
      size: element.size,
      opacity: element.opacity,
      zIndex: element.zIndex,
      backgroundColor: element.backgroundColor,
      borderColor: element.borderColor,
      borderRadius: element.borderRadius,
      borderWidth: 1,
      fillMode: 'both',
    }
    this.panelRenderer?.addPanel(panelOptions)

    // ボタンのテキストを描画
    if (element.textStyle && element.size) {
      const textOptions: UIRenderOptions = {
        position: {
          x:
            element.position.x +
            element.size.width / 2 -
            element.text.length * (element.textStyle.fontSize / 4),
          y:
            element.position.y +
            element.size.height / 2 -
            element.textStyle.fontSize / 2,
        },
        zIndex: (element.zIndex || 0) + 1,
      }
      this.textRenderer?.addText(element.text, textOptions, element.textStyle)
    }
  }

  private renderTextElement(element: TextUIElement): void {
    const options: UIRenderOptions = {
      position: element.position,
      size: element.size,
      opacity: element.opacity,
      zIndex: element.zIndex,
    }
    this.textRenderer?.addText(element.text, options, element.style)
  }

  private renderSelectionElement(element: SelectionUIElement): void {
    const bbox = element.boundingBox

    // 選択ボックスの背景（半透明）
    if (element.fillColor) {
      const fillOptions: UIRenderOptions = {
        position: { x: bbox.x, y: bbox.y },
        size: { width: bbox.width, height: bbox.height },
        opacity: element.opacity,
        zIndex: element.zIndex,
        backgroundColor: element.fillColor,
        fillMode: 'fill',
      }
      this.panelRenderer?.addPanel(fillOptions)
    }

    // 選択ボックスの枠線
    if (element.strokeColor) {
      const strokeOptions: UIRenderOptions = {
        position: { x: bbox.x, y: bbox.y },
        size: { width: bbox.width, height: bbox.height },
        opacity: element.opacity,
        zIndex: element.zIndex,
        borderColor: element.strokeColor,
        borderWidth: 1,
        fillMode: 'stroke',
      }
      this.panelRenderer?.addPanel(strokeOptions)
    }

    // ハンドル（リサイズ用の四角）
    if (element.showHandles) {
      const handleSize = element.handleSize || 8
      const handleColor = element.strokeColor || {
        r: 0.2,
        g: 0.6,
        b: 1.0,
        a: 1.0,
      }

      const handles = [
        { x: bbox.x - handleSize / 2, y: bbox.y - handleSize / 2 }, // 左上
        { x: bbox.x + bbox.width - handleSize / 2, y: bbox.y - handleSize / 2 }, // 右上
        {
          x: bbox.x + bbox.width - handleSize / 2,
          y: bbox.y + bbox.height - handleSize / 2,
        }, // 右下
        {
          x: bbox.x - handleSize / 2,
          y: bbox.y + bbox.height - handleSize / 2,
        }, // 左下
        {
          x: bbox.x + bbox.width / 2 - handleSize / 2,
          y: bbox.y - handleSize / 2,
        }, // 上中央
        {
          x: bbox.x + bbox.width / 2 - handleSize / 2,
          y: bbox.y + bbox.height - handleSize / 2,
        }, // 下中央
        {
          x: bbox.x - handleSize / 2,
          y: bbox.y + bbox.height / 2 - handleSize / 2,
        }, // 左中央
        {
          x: bbox.x + bbox.width - handleSize / 2,
          y: bbox.y + bbox.height / 2 - handleSize / 2,
        }, // 右中央
      ]

      for (const handle of handles) {
        const handleOptions: UIRenderOptions = {
          position: handle,
          size: { width: handleSize, height: handleSize },
          opacity: element.opacity,
          zIndex: (element.zIndex || 0) + 1,
          backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
          borderColor: handleColor,
          borderWidth: 1,
          fillMode: 'both',
        }
        this.panelRenderer?.addPanel(handleOptions)
      }
    }
  }

  private renderVertexElement(element: VertexUIElement): void {
    const size = element.vertexSize || 6
    const color = element.color || { r: 1, g: 1, b: 1, a: 1 }
    const strokeColor = element.selected
      ? { r: 1, g: 0.5, b: 0, a: 1 } // 選択時はオレンジ
      : { r: 0.2, g: 0.2, b: 0.2, a: 1 } // 通常時は濃いグレー

    // 頂点の種類によって形状を変える
    if (element.vertexType === 'anchor') {
      // アンカーポイントは四角
      const options: UIRenderOptions = {
        position: {
          x: element.position.x - size,
          y: element.position.y - size,
        },
        size: { width: size * 2, height: size * 2 },
        opacity: element.opacity,
        zIndex: element.zIndex,
        backgroundColor: color,
        borderColor: strokeColor,
        borderWidth: 1,
        fillMode: 'both',
      }
      this.panelRenderer?.addPanel(options)
    } else {
      // コントロールポイントは円（四角で近似）
      const options: UIRenderOptions = {
        position: {
          x: element.position.x - size / 2,
          y: element.position.y - size / 2,
        },
        size: { width: size, height: size },
        opacity: element.opacity,
        zIndex: element.zIndex,
        backgroundColor: color,
        borderColor: strokeColor,
        borderWidth: 1,
        borderRadius: size / 2,
        fillMode: 'both',
      }
      this.panelRenderer?.addPanel(options)
    }
  }

  private renderGridElement(element: GridUIElement): void {
    const gridSize = element.gridSize
    const color = element.color || { r: 0.7, g: 0.7, b: 0.7, a: 0.5 }
    const canvasWidth = element.size?.width || 800
    const canvasHeight = element.size?.height || 600

    // 縦線
    for (let x = 0; x <= canvasWidth; x += gridSize) {
      const lineOptions: UIRenderOptions = {
        position: { x, y: 0 },
        size: { width: 1, height: canvasHeight },
        opacity: element.opacity,
        zIndex: element.zIndex,
        backgroundColor: color,
        fillMode: 'fill',
      }
      this.panelRenderer?.addPanel(lineOptions)
    }

    // 横線
    for (let y = 0; y <= canvasHeight; y += gridSize) {
      const lineOptions: UIRenderOptions = {
        position: { x: 0, y },
        size: { width: canvasWidth, height: 1 },
        opacity: element.opacity,
        zIndex: element.zIndex,
        backgroundColor: color,
        fillMode: 'fill',
      }
      this.panelRenderer?.addPanel(lineOptions)
    }
  }

  /**
   * レガシーAPI - 後方互換性のため
   */
  renderText(text: string, options: UIRenderOptions, style: TextStyle): void {
    this.textRenderer?.addText(text, options, style)
  }

  renderIcon(iconName: string, options: UIRenderOptions): void {
    this.iconRenderer?.addIcon(iconName, options)
  }

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
  }

  private createUniformBuffer(): void {
    this.uniformBuffer = this.device.createBuffer({
      label: 'UIPanelRenderer-UniformBuffer',
      size: 16, // vec2 + f32 + f32 (padding)
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

    // 画面サイズをユニフォームに設定（仮の値、実際の実装では動的に取得）
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

    // 矩形の6頂点（2つの三角形）を生成
    const vertices = new Float32Array([
      // 第1三角形
      position.x,
      position.y,
      color.r,
      color.g,
      color.b,
      color.a, // 左上
      position.x + actualSize.width,
      position.y,
      color.r,
      color.g,
      color.b,
      color.a, // 右上
      position.x,
      position.y + actualSize.height,
      color.r,
      color.g,
      color.b,
      color.a, // 左下

      // 第2三角形
      position.x + actualSize.width,
      position.y,
      color.r,
      color.g,
      color.b,
      color.a, // 右上
      position.x + actualSize.width,
      position.y + actualSize.height,
      color.r,
      color.g,
      color.b,
      color.a, // 右下
      position.x,
      position.y + actualSize.height,
      color.r,
      color.g,
      color.b,
      color.a, // 左下
    ])

    // 頂点バッファを作成
    const vertexBuffer = this.device.createBuffer({
      label:
        'UIPanelRenderer-VertexBuffer-' +
        Math.random().toString(36).substring(7),
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })

    this.device.queue.writeBuffer(vertexBuffer, 0, vertices)

    // 描画
    renderPass.setVertexBuffer(0, vertexBuffer)
    renderPass.draw(6) // 6頂点（2つの三角形）

    // バッファを返す（呼び出し元で破棄）
    return vertexBuffer
  }

  clearQueue(): void {
    this.panelQueue.length = 0
  }

  dispose(): void {
    this.uniformBuffer?.destroy()
  }
}
