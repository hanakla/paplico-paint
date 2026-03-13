/**
 * WebGPU UI Rendering System
 *
 * 統合UIレンダリングシステム：宣言的UI・テキスト・アイコン・UI要素を効率的に描画
 */

import type { VectorPath } from '../../document/path';

export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  color: { r: number; g: number; b: number; a: number };
  bold?: boolean;
  italic?: boolean;
}

export interface UIRenderOptions {
  position: { x: number; y: number };
  size?: { width: number; height: number };
  opacity?: number;
  zIndex?: number;
  backgroundColor?: { r: number; g: number; b: number; a: number };
  borderColor?: { r: number; g: number; b: number; a: number };
  borderRadius?: number;
  borderWidth?: number;
  fillMode?: 'fill' | 'stroke' | 'both';
}

// 宣言的UI要素の基底型
export interface UIElement {
  id: string;
  name?: string; // デバッグ用の名前
  type: string;
  position: 'screen' | 'local';
  location?: { x: number; y: number };
  size?: { width: number; height: number };
  zIndex?: number;
  visible?: boolean;
  opacity?: number;
  children?: UIElement[];
}

export interface TextUIElement extends UIElement {
  type: 'text';
  text: string;
  style?: TextStyle;
  color?: { r: number; g: number; b: number; a: number };
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  padding?: number;
  backgroundColor?: { r: number; g: number; b: number; a: number };
}

export interface SurfaceUIElement extends UIElement {
  type: 'surface';
  backgroundColor?: { r: number; g: number; b: number; a: number };
  borderColor?: { r: number; g: number; b: number; a: number };
  borderRadius?: number;
  borderWidth?: number;
  fillMode?: 'fill' | 'stroke' | 'both';
}

export interface ButtonUIElement extends UIElement {
  type: 'button';
  text: string;
  backgroundColor?: { r: number; g: number; b: number; a: number };
  borderColor?: { r: number; g: number; b: number; a: number };
  borderRadius?: number;
  borderWidth?: number;
  textColor?: { r: number; g: number; b: number; a: number };
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  onClick?: () => void;
}

export interface PathUIElement extends UIElement {
  type: 'path';
  path: VectorPath;
  strokeColor?: { r: number; g: number; b: number; a: number };
  strokeWidth?: number;
  fillColor?: { r: number; g: number; b: number; a: number };
  dashPattern?: number[];
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
}

export type AnyUIElement =
  | TextUIElement
  | SurfaceUIElement
  | ButtonUIElement
  | PathUIElement;

/**
 * UIビルダークラス
 */
export class UIBuilder {
  private elements: UIElement[] = [];

  /**
   * テキスト要素を追加
   */
  text(text: string, options: Partial<TextUIElement>): TextUIElement {
    const element: TextUIElement = {
      id: options.id || `text-${Math.random().toString(36).substr(2, 9)}`,
      name: options.name || `text-${text}`, // デバッグ用の名前
      type: 'text',
      text,
      position: options.position || 'screen',
      location: options.location || { x: 0, y: 0 },
      size: options.size,
      zIndex: options.zIndex || 0,
      visible: options.visible !== false,
      opacity: options.opacity || 1.0,
      color: options.color, // 直接指定されたcolorプロパティを設定
      fontSize: options.fontSize,
      fontFamily: options.fontFamily,
      bold: options.bold,
      italic: options.italic,
      padding: options.padding || 4,
      style: options.style || {
        fontSize: options.fontSize || 16,
        fontFamily: options.fontFamily || 'Arial',
        color: options.color || { r: 0, g: 0, b: 0, a: 1 },
      },
      children: options.children || [],
    };

    this.elements.push(element);
    return element;
  }

  /**
   * サーフェス要素を追加
   */
  surface(options: Partial<SurfaceUIElement>): SurfaceUIElement {
    const element: SurfaceUIElement = {
      id: options.id || `surface-${Math.random().toString(36).substr(2, 9)}`,
      type: 'surface',
      position: options.position || 'screen',
      location: options.location || { x: 0, y: 0 },
      size: options.size || { width: 100, height: 100 },
      zIndex: options.zIndex || 0,
      visible: options.visible !== false,
      opacity: options.opacity || 1.0,
      backgroundColor: options.backgroundColor,
      borderColor: options.borderColor,
      borderRadius: options.borderRadius || 0,
      borderWidth: options.borderWidth || 0,
      fillMode: options.fillMode || 'fill',
      children: options.children || [],
    };

    this.elements.push(element);
    return element;
  }

  /**
   * ボタン要素を追加
   */
  button(
    text: string,
    onClick: () => void,
    options: Partial<ButtonUIElement> = {},
  ): ButtonUIElement {
    const element: ButtonUIElement = {
      id: options.id || `button-${Math.random().toString(36).substr(2, 9)}`,
      type: 'button',
      text,
      position: options.position || 'screen',
      location: options.location || { x: 0, y: 0 },
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
      borderWidth: options.borderWidth || 1,
      textColor: options.textColor || { r: 0, g: 0, b: 0, a: 1 },
      fontSize: options.fontSize || 14,
      fontFamily: options.fontFamily || 'Arial',
      bold: options.bold || false,
      onClick,
      children: options.children || [],
    };

    this.elements.push(element);
    return element;
  }

  /**
   * パス要素を追加
   */
  path(path: VectorPath, options: Partial<PathUIElement> = {}): PathUIElement {
    const element: PathUIElement = {
      id: options.id || `path-${Math.random().toString(36).substr(2, 9)}`,
      type: 'path',
      path,
      position: options.position || 'local',
      location: options.location || { x: 0, y: 0 },
      size: options.size,
      zIndex: options.zIndex || 0,
      visible: options.visible !== false,
      opacity: options.opacity || 1.0,
      strokeColor: options.strokeColor || { r: 0, g: 0, b: 0, a: 1 },
      strokeWidth: options.strokeWidth || 2,
      fillColor: options.fillColor,
      dashPattern: options.dashPattern,
      lineCap: options.lineCap || 'round',
      lineJoin: options.lineJoin || 'round',
      children: options.children || [],
    };

    this.elements.push(element);
    return element;
  }

  /**
   * 構築したUI要素を取得
   */
  build(): UIElement[] {
    const result = [...this.elements];
    this.elements = []; // リセット
    return result;
  }

  /**
   * 全要素をクリア
   */
  clear(): UIBuilder {
    this.elements = [];
    return this;
  }
}

/**
 * 宣言的UIビルダー - ReactライクなAPI
 */
export const ui = {
  /**
   * テキスト要素を作成
   */
  text(text: string, options: Partial<TextUIElement> = {}): TextUIElement {
    return {
      id: options.id || `text-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      text,
      position: options.position || 'screen',
      location: options.location || { x: 0, y: 0 },
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
    };
  },

  /**
   * サーフェス要素を作成
   */
  surface(options: Partial<SurfaceUIElement> = {}): SurfaceUIElement {
    return {
      id: options.id || `surface-${Math.random().toString(36).substr(2, 9)}`,
      type: 'surface',
      position: options.position || 'screen',
      location: options.location || { x: 0, y: 0 },
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
    };
  },

  /**
   * ボタン要素を作成
   */
  button(
    text: string,
    onClick: () => void,
    options: Partial<ButtonUIElement> = {},
  ): ButtonUIElement {
    return {
      id: options.id || `button-${Math.random().toString(36).substr(2, 9)}`,
      type: 'button',
      text,
      position: options.position || 'screen',
      location: options.location || { x: 0, y: 0 },
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
      borderWidth: options.borderWidth || 1,
      textColor: options.textColor || { r: 0, g: 0, b: 0, a: 1 },
      fontSize: options.fontSize || 14,
      fontFamily: options.fontFamily || 'Arial',
      bold: options.bold || false,
      onClick,
      children: options.children || [],
    };
  },

  /**
   * パス要素を作成
   */
  path(path: VectorPath, options: Partial<PathUIElement> = {}): PathUIElement {
    return {
      id: options.id || `path-${Math.random().toString(36).substr(2, 9)}`,
      type: 'path',
      path,
      position: options.position || 'local',
      location: options.location || { x: 0, y: 0 },
      size: options.size,
      zIndex: options.zIndex || 0,
      visible: options.visible !== false,
      opacity: options.opacity || 1.0,
      strokeColor: options.strokeColor || { r: 0, g: 0, b: 0, a: 1 },
      strokeWidth: options.strokeWidth || 2,
      fillColor: options.fillColor,
      dashPattern: options.dashPattern,
      lineCap: options.lineCap || 'round',
      lineJoin: options.lineJoin || 'round',
      children: options.children || [],
    };
  },
};
