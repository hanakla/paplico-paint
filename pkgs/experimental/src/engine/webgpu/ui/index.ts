/**
 * WebGPU UI Integration
 *
 * メインWebGPUエンジンとUIレンダリングシステムの統合
 */

import type { UIRenderer, TextStyle } from './ui-renderer'

export { UIRenderer } from './ui-renderer'
export type { TextStyle, UIRenderOptions } from './ui-renderer'
export { UITestComponents } from './test-components'

// UI要素の型定義
export interface UIElement {
  id: string
  type: 'text' | 'icon' | 'panel' | 'button'
  position: { x: number; y: number }
  size?: { width: number; height: number }
  visible: boolean
  zIndex: number
  interactive?: boolean
  onClick?: () => void
  onHover?: (isHovering: boolean) => void
}

export interface TextUIElement extends UIElement {
  type: 'text'
  text: string
  style: TextStyle
}

export interface IconUIElement extends UIElement {
  type: 'icon'
  iconName: string
  size: { width: number; height: number }
}

export interface PanelUIElement extends UIElement {
  type: 'panel'
  size: { width: number; height: number }
  backgroundColor?: { r: number; g: number; b: number; a: number }
  borderRadius?: number
  borderWidth?: number
  borderColor?: { r: number; g: number; b: number; a: number }
  fillMode?: 'fill' | 'stroke' | 'both'
}

export interface ButtonUIElement extends UIElement {
  type: 'button'
  text: string
  size: { width: number; height: number }
  backgroundColor: { r: number; g: number; b: number; a: number }
  textColor: { r: number; g: number; b: number; a: number }
  borderRadius?: number
  fontSize?: number
  interactive: true
}

// UI管理クラス
export class UIManager {
  private elements: Map<string, UIElement> = new Map()
  private uiRenderer: UIRenderer | null = null
  private hoveredElement: string | null = null

  setRenderer(renderer: UIRenderer): void {
    this.uiRenderer = renderer
  }

  addElement(element: UIElement): void {
    this.elements.set(element.id, element)
  }

  removeElement(id: string): void {
    this.elements.delete(id)
  }

  updateElement(id: string, updates: Partial<UIElement>): void {
    const element = this.elements.get(id)
    if (element) {
      Object.assign(element, updates)
    }
  }

  /** マウス位置での当たり判定を実行 */
  handleMouseEvent(x: number, y: number, eventType: 'click' | 'move'): boolean {
    const hitElement = this.getElementAtPosition(x, y)

    if (eventType === 'move') {
      // ホバー状態の更新
      if (this.hoveredElement !== hitElement?.id) {
        // 前の要素のホバーを解除
        if (this.hoveredElement) {
          const prevElement = this.elements.get(this.hoveredElement)
          if (prevElement?.onHover) {
            prevElement.onHover(false)
          }
        }

        // 新しい要素のホバーを設定
        this.hoveredElement = hitElement?.id || null
        if (hitElement?.onHover) {
          hitElement.onHover(true)
        }
      }
    } else if (eventType === 'click' && hitElement?.onClick) {
      hitElement.onClick()
      return true // イベントを処理した
    }

    return false
  }

  /** 指定位置にあるUI要素を取得（最前面から検索） */
  private getElementAtPosition(x: number, y: number): UIElement | null {
    const sortedElements = Array.from(this.elements.values())
      .filter((el) => el.visible && el.interactive)
      .sort((a, b) => b.zIndex - a.zIndex) // 最前面から検索

    for (const element of sortedElements) {
      if (this.isPointInElement(x, y, element)) {
        return element
      }
    }

    return null
  }

  /** 点がUI要素内にあるかチェック */
  private isPointInElement(x: number, y: number, element: UIElement): boolean {
    const size = element.size || this.getElementDefaultSize(element)

    return (
      x >= element.position.x &&
      x <= element.position.x + size.width &&
      y >= element.position.y &&
      y <= element.position.y + size.height
    )
  }

  /** UI要素のデフォルトサイズを取得 */
  private getElementDefaultSize(element: UIElement): {
    width: number
    height: number
  } {
    switch (element.type) {
      case 'text':
        const textEl = element as TextUIElement
        // テキストサイズを概算（実際の実装では正確な測定が必要）
        return {
          width: textEl.text.length * (textEl.style.fontSize || 16) * 0.6,
          height: textEl.style.fontSize || 16,
        }
      case 'icon':
        return { width: 24, height: 24 }
      default:
        return { width: 100, height: 30 }
    }
  }

  async renderUI(renderPass: GPURenderPassEncoder): Promise<GPUBuffer[]> {
    if (!this.uiRenderer) return []

    this.uiRenderer.beginFrame()

    // zIndexでソートして描画順序を制御
    const sortedElements = Array.from(this.elements.values())
      .filter((el) => el.visible)
      .sort((a, b) => a.zIndex - b.zIndex)

    for (const element of sortedElements) {
      switch (element.type) {
        case 'text':
          const textEl = element as TextUIElement
          this.uiRenderer.renderText(
            textEl.text,
            {
              position: textEl.position,
              zIndex: textEl.zIndex,
            },
            textEl.style,
          )
          break

        case 'icon':
          const iconEl = element as IconUIElement
          this.uiRenderer.renderIcon(iconEl.iconName, {
            position: iconEl.position,
            size: iconEl.size,
            zIndex: iconEl.zIndex,
          })
          break

        case 'panel':
          const panelEl = element as PanelUIElement
          this.uiRenderer.renderPanel({
            position: panelEl.position,
            size: panelEl.size,
            backgroundColor: panelEl.backgroundColor,
            borderRadius: panelEl.borderRadius,
            borderWidth: panelEl.borderWidth,
            borderColor: panelEl.borderColor,
            fillMode: panelEl.fillMode,
            zIndex: panelEl.zIndex,
          })
          break

        case 'button':
          const buttonEl = element as ButtonUIElement
          // ボタンは背景パネル+テキストの組み合わせで描画
          this.uiRenderer.renderPanel({
            position: buttonEl.position,
            size: buttonEl.size,
            backgroundColor: buttonEl.backgroundColor,
            zIndex: buttonEl.zIndex,
          })

          this.uiRenderer.renderText(
            buttonEl.text,
            {
              position: {
                x: buttonEl.position.x + buttonEl.size.width / 2,
                y: buttonEl.position.y + buttonEl.size.height / 2,
              },
              zIndex: buttonEl.zIndex + 1,
            },
            {
              fontSize: buttonEl.fontSize || 16,
              fontFamily: 'Arial',
              color: buttonEl.textColor,
            },
          )
          break
      }
    }

    return await this.uiRenderer.renderUILayer(renderPass)
  }
}

// UIヘルパー関数
export const createTextElement = (
  id: string,
  text: string,
  position: { x: number; y: number },
  style: Partial<TextStyle> = {},
): TextUIElement => ({
  id,
  type: 'text',
  text,
  position,
  visible: true,
  zIndex: 0,
  style: {
    fontSize: 16,
    fontFamily: 'Arial',
    color: { r: 0, g: 0, b: 0, a: 1 },
    ...style,
  },
})

export const createIconElement = (
  id: string,
  iconName: string,
  position: { x: number; y: number },
  size: { width: number; height: number } = { width: 24, height: 24 },
): IconUIElement => ({
  id,
  type: 'icon',
  iconName,
  position,
  size,
  visible: true,
  zIndex: 0,
})

export const createPanelElement = (
  id: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
  options: {
    backgroundColor?: { r: number; g: number; b: number; a: number }
    borderRadius?: number
    borderWidth?: number
    borderColor?: { r: number; g: number; b: number; a: number }
    fillMode?: 'fill' | 'stroke' | 'both'
    zIndex?: number
  } = {},
): PanelUIElement => ({
  id,
  type: 'panel',
  position,
  size,
  backgroundColor: options.backgroundColor || { r: 1, g: 1, b: 1, a: 0.8 },
  borderRadius: options.borderRadius,
  borderWidth: options.borderWidth,
  borderColor: options.borderColor,
  fillMode: options.fillMode || 'fill',
  visible: true,
  zIndex: options.zIndex ?? -1, // パネルは背景なので低いzIndex
})

export const createButtonElement = (
  id: string,
  text: string,
  position: { x: number; y: number },
  size: { width: number; height: number } = { width: 120, height: 40 },
  onClick?: () => void,
  options: {
    backgroundColor?: { r: number; g: number; b: number; a: number }
    textColor?: { r: number; g: number; b: number; a: number }
    fontSize?: number
    zIndex?: number
  } = {},
): ButtonUIElement => ({
  id,
  type: 'button',
  text,
  position,
  size,
  backgroundColor: options.backgroundColor || { r: 0.2, g: 0.5, b: 0.8, a: 1 },
  textColor: options.textColor || { r: 1, g: 1, b: 1, a: 1 },
  fontSize: options.fontSize || 16,
  visible: true,
  zIndex: options.zIndex || 10,
  interactive: true,
  onClick,
  onHover: (isHovering) => {
    // ホバー時の視覚フィードバック（今後実装）
    console.log(`Button ${id} hover: ${isHovering}`)
  },
})

/** 宣言的UIコンポーネント作成ヘルパー */
export class UIBuilder {
  private elements: UIElement[] = []

  text(
    id: string,
    text: string,
    x: number,
    y: number,
    style?: Partial<TextStyle>,
  ): UIBuilder {
    this.elements.push(createTextElement(id, text, { x, y }, style))
    return this
  }

  button(
    id: string,
    text: string,
    x: number,
    y: number,
    onClick?: () => void,
    options?: Parameters<typeof createButtonElement>[5],
  ): UIBuilder {
    this.elements.push(
      createButtonElement(id, text, { x, y }, undefined, onClick, options),
    )
    return this
  }

  panel(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    options?: {
      backgroundColor?: { r: number; g: number; b: number; a: number }
      borderRadius?: number
      borderWidth?: number
      borderColor?: { r: number; g: number; b: number; a: number }
      fillMode?: 'fill' | 'stroke' | 'both'
      zIndex?: number
    },
  ): UIBuilder {
    this.elements.push(
      createPanelElement(id, { x, y }, { width, height }, options),
    )
    return this
  }

  build(): UIElement[] {
    return [...this.elements]
  }
}
