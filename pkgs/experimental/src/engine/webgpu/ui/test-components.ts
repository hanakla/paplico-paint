/**
 * WebGPU UI テストコンポーネント
 *
 * UI システムの動作確認用のテストコンポーネント
 */

import {
  UIManager,
  UIBuilder,
  createButtonElement,
  createPanelElement,
  UIElement,
} from './index'
import { debugLogger } from '../../../utils/debug-logger'

export class UITestComponents {
  private uiManager: UIManager

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager
  }

  /** 基本的なテストUIを作成 */
  createBasicTestUI(): void {
    debugLogger.debug('Creating basic test UI components')

    // 1. テストボタンを作成（右上に配置）
    const testButton = createButtonElement(
      'test-button-1',
      'Click Me!',
      { x: 20, y: 20 },
      { width: 120, height: 40 },
      () => {
        console.log('Test button clicked!')
        debugLogger.info('UI Test Button was clicked')

        // ボタンクリック時の動作例
        this.toggleButtonText()
      },
      {
        backgroundColor: { r: 0.2, g: 0.6, b: 0.8, a: 1 },
        textColor: { r: 1, g: 1, b: 1, a: 1 },
        fontSize: 16,
        zIndex: 100,
      },
    )

    this.uiManager.addElement(testButton)

    // 2. 情報表示テキスト
    const infoText = new UIBuilder()
      .text('info-text', 'WebGPU UI System Test', 20, 80, {
        fontSize: 14,
        fontFamily: 'Arial',
        color: { r: 0.2, g: 0.2, b: 0.2, a: 1 },
      })
      .build()[0]

    infoText.zIndex = 50
    this.uiManager.addElement(infoText)

    // 3. 複数ボタンのテスト
    const secondButton = createButtonElement(
      'test-button-2',
      'Button 2',
      { x: 160, y: 20 },
      { width: 100, height: 40 },
      () => {
        console.log('Second button clicked!')
        this.changeButtonColor()
      },
      {
        backgroundColor: { r: 0.8, g: 0.4, b: 0.2, a: 1 },
        textColor: { r: 1, g: 1, b: 1, a: 1 },
        zIndex: 100,
      },
    )

    this.uiManager.addElement(secondButton)

    debugLogger.debug('Basic test UI components created')
  }

  /** 宣言的UIビルダーのテスト */
  createDeclarativeTestUI(): void {
    debugLogger.debug('Creating declarative test UI')

    const elements = new UIBuilder()
      .panel('test-panel', 300, 20, 200, 150, {
        backgroundColor: { r: 0.95, g: 0.95, b: 0.95, a: 0.9 },
        borderRadius: 8,
        borderWidth: 2,
        borderColor: { r: 0.2, g: 0.2, b: 0.2, a: 1 },
        fillMode: 'both',
      })
      .text('panel-title', 'UI Panel Test', 310, 40, {
        fontSize: 16,
        fontFamily: 'Arial',
        color: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
      })
      .button('panel-button-1', 'Action 1', 310, 70, () => {
        console.log('Panel Action 1 clicked')
      })
      .button(
        'panel-button-2',
        'Action 2',
        310,
        120,
        () => {
          console.log('Panel Action 2 clicked')
        },
        {
          backgroundColor: { r: 0.6, g: 0.8, b: 0.4, a: 1 },
        },
      )
      .build()

    // パネルのzIndexを調整
    elements[0].zIndex = 20 // panel
    elements[1].zIndex = 25 // title
    elements[2].zIndex = 30 // button 1
    elements[3].zIndex = 30 // button 2

    elements.forEach((element: UIElement) => {
      this.uiManager.addElement(element)
    })

    debugLogger.debug('Declarative test UI created')
  }

  /** 角丸・枠線テストUIを作成 */
  createStyledTestUI(): void {
    debugLogger.debug(
      'Creating styled test UI with rounded corners and borders',
    )

    // 角丸パネルのテスト
    const roundedPanel = createPanelElement(
      'rounded-panel',
      { x: 520, y: 50 },
      { width: 180, height: 100 },
      {
        backgroundColor: { r: 0.1, g: 0.3, b: 0.7, a: 0.8 },
        borderRadius: 12,
        fillMode: 'fill',
      },
    )
    this.uiManager.addElement(roundedPanel)

    // 枠線だけのパネル
    const strokePanel = createPanelElement(
      'stroke-panel',
      { x: 520, y: 170 },
      { width: 180, height: 80 },
      {
        borderRadius: 8,
        borderWidth: 3,
        borderColor: { r: 0.8, g: 0.2, b: 0.2, a: 1 },
        fillMode: 'stroke',
      },
    )
    this.uiManager.addElement(strokePanel)

    // 塗り+枠線のパネル
    const bothPanel = createPanelElement(
      'both-panel',
      { x: 520, y: 270 },
      { width: 180, height: 80 },
      {
        backgroundColor: { r: 0.2, g: 0.8, b: 0.4, a: 0.6 },
        borderRadius: 16,
        borderWidth: 2,
        borderColor: { r: 0.1, g: 0.4, b: 0.2, a: 1 },
        fillMode: 'both',
      },
    )
    this.uiManager.addElement(bothPanel)

    // スタイル付きボタン
    const styledButton = createButtonElement(
      'styled-button',
      'Rounded Button',
      { x: 540, y: 200 },
      { width: 140, height: 35 },
      () => {
        console.log('Styled button clicked!')
        this.changeButtonStyle()
      },
      {
        backgroundColor: { r: 0.9, g: 0.5, b: 0.1, a: 1 },
        textColor: { r: 1, g: 1, b: 1, a: 1 },
        fontSize: 14,
        zIndex: 100,
      },
    )

    this.uiManager.addElement(styledButton)

    debugLogger.debug('Styled test UI components created')
  }

  /** ボタンテキストを切り替える */
  private toggleButtonText(): void {
    this.uiManager.updateElement('test-button-1', {
      text: Math.random() > 0.5 ? 'Clicked!' : 'Click Me!',
    } as any)
  }

  /** ボタンの色を変更する */
  private changeButtonColor(): void {
    const colors = [
      { r: 0.8, g: 0.4, b: 0.2, a: 1 },
      { r: 0.2, g: 0.8, b: 0.4, a: 1 },
      { r: 0.6, g: 0.2, b: 0.8, a: 1 },
      { r: 0.8, g: 0.6, b: 0.2, a: 1 },
    ]

    const randomColor = colors[Math.floor(Math.random() * colors.length)]

    this.uiManager.updateElement('test-button-2', {
      backgroundColor: randomColor,
    } as any)
  }

  /** スタイル付きボタンのスタイル変更 */
  private changeButtonStyle(): void {
    const styles = [
      { r: 0.9, g: 0.5, b: 0.1, a: 1 }, // オレンジ
      { r: 0.7, g: 0.2, b: 0.8, a: 1 }, // 紫
      { r: 0.2, g: 0.8, b: 0.6, a: 1 }, // 緑
      { r: 0.8, g: 0.3, b: 0.3, a: 1 }, // 赤
    ]

    const randomStyle = styles[Math.floor(Math.random() * styles.length)]

    this.uiManager.updateElement('styled-button', {
      backgroundColor: randomStyle,
    } as any)
  }

  /** すべてのテストUIを削除 */
  clearTestUI(): void {
    const testElementIds = [
      'test-button-1',
      'test-button-2',
      'info-text',
      'test-panel',
      'panel-title',
      'panel-button-1',
      'panel-button-2',
      'rounded-panel',
      'stroke-panel',
      'both-panel',
      'styled-button',
    ]

    testElementIds.forEach((id) => {
      this.uiManager.removeElement(id)
    })

    debugLogger.debug('Test UI components cleared')
  }
}
