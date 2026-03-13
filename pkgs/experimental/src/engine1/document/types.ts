/**
 * 基本座標・変形情報
 */
export interface Transform {
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
}

/**
 * 描画境界領域
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 基本的な色情報（RGBA）
 */
export interface RGBAColor {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1
}

/**
 * グラデーション停止点
 */
export interface GradientStop {
  position: number; // 0-1
  color: RGBAColor;
}

/**
 * グラデーション情報
 */
export interface Gradient {
  type: 'linear' | 'radial';
  stops: GradientStop[];
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  center?: { x: number; y: number };
  radius?: number;
}

/**
 * UUID型（文字列）
 */
export type UUID = string;

/**
 * ベクターパスポイント
 */
export interface VectorPoint {
  x: number;
  y: number;
  /** 制御点（入力方向） */
  handleIn?: { x: number; y: number } | null;
  /** 制御点（出力方向） */
  handleOut?: { x: number; y: number } | null;
  /** 筆圧情報（0-1） */
  pressure?: number;
  /** タイルト情報 */
  tilt?: { x: number; y: number };
}

/**
 * ブレンドモード
 */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'color-dodge'
  | 'color-burn'
  | 'darken'
  | 'lighten'
  | 'difference'
  | 'exclusion';
