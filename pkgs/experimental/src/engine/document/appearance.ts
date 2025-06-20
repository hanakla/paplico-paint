import { RGBAColor, Gradient, BlendMode, UUID } from './types'
import { generateUid } from './utils'

/**
 * 基本アピアランス構造（ジェネリック型）
 */
export interface BaseAppearance<T = Record<string, any>> {
  /** ユニークID */
  uid: UUID
  /** 有効・無効 */
  enabled: boolean
  /** エフェクトID（タイプ識別） */
  effectId: string
  /** アピアランス固有のパラメータ */
  params: T
}

/**
 * 塗りアピアランスのパラメータ
 */
export interface FillParams {
  /** 塗りの種類 */
  fillType: 'solid' | 'gradient'
  /** 単色塗りの色 */
  color?: RGBAColor
  /** グラデーション塗りの設定 */
  gradient?: Gradient
  /** 不透明度（0-1） */
  opacity: number
  /** ブレンドモード */
  blendMode: BlendMode
}

/**
 * 線アピアランスのパラメータ
 */
export interface StrokeParams {
  /** 線の太さ */
  width: number
  /** 線の色 */
  color: RGBAColor
  /** 線の種類 */
  style: 'solid' | 'dashed' | 'dotted'
  /** 破線のパターン */
  dashPattern?: number[]
  /** 線の端の形状 */
  lineCap: 'butt' | 'round' | 'square'
  /** 線の接続部分の形状 */
  lineJoin: 'miter' | 'round' | 'bevel'
  /** 尖った接続部分の制限 */
  miterLimit?: number
  /** 不透明度（0-1） */
  opacity: number
  /** ブレンドモード */
  blendMode: BlendMode
  /** ブラシ設定（詳細なストローク描画用） */
  brushSettings?: BrushSettings
}

/**
 * ブラシ設定インターフェース
 * WebGPU ベースのストローク描画システムで使用される詳細なブラシパラメータを定義
 *
 * @description
 * このインターフェースは高度なストローク描画機能を提供し、以下の機能をサポート:
 * - 筆圧感知による動的なサイズ・不透明度制御
 * - ペンの傾き（Tilt）による形状変化
 * - 描画速度による表現の変化
 * - ランダム要素による自然な描画効果
 * - 各種テクスチャとスキャッター効果
 *
 * @example
 * ```typescript
 * const pencilBrush: BrushSettings = {
 *   texture: 'pencil',
 *   scatterRange: 0.5,
 *   pressureSizeInfluence: 0.8,
 *   pressureOpacityInfluence: 0.6,
 *   tiltInfluence: 0.3,
 *   velocitySizeInfluence: 0.2
 * }
 * ```
 *
 * @see {@link StrokeParams} - このブラシ設定を含むストロークアピアランス
 * @see {@link createStrokeAppearance} - ブラシ設定を含むストローク作成関数
 */
export interface BrushSettings {
  /** ブラシテクスチャタイプ - 描画の基本的な見た目を決定 */
  texture: 'pencil' | 'airbrush'

  scatterConfig?: {
    count: number
    spread: number
    sizeVariation: number
    opacityVariation: number
  }

  /** 回転調整係数 (0.0-2.0) - ブラシの回転に対する感度 */
  rotationAdjust: number

  /** ランダム回転 (0.0-1.0) - ブラシポイントのランダム回転量 */
  randomRotation: number

  /** ランダムスケール (0.0-1.0) - ブラシポイントのランダムサイズ変化 */
  randomScale: number

  /** インアウト効果の影響度 (0.0-1.0) - ストローク始端・終端でのフェード効果 */
  inOutInfluence: number

  /** インアウト効果の長さ (px) - フェード効果が適用される距離 */
  inOutLength: number

  /** ストローク分割数 - より高い値でより滑らかな描画（パフォーマンスとのトレードオフ） */
  divisions: number

  /** 筆圧の全体的な影響度 (0.0-1.0) - レガシー設定、新しい個別設定を推奨 */
  pressureInfluence: number

  /** ノイズの影響度 (0.0-1.0) - ブラシポイントへのランダムノイズ適用 */
  noiseInfluence: number

  /** 筆圧によるサイズへの影響度 (0.0-1.0) */
  pressureSizeInfluence?: number

  /** 筆圧による不透明度への影響度 (0.0-1.0) */
  pressureOpacityInfluence?: number

  /** ペンの傾きによる形状への影響度 (0.0-1.0) */
  tiltInfluence?: number

  /** 描画速度によるサイズへの影響度 (0.0-1.0) */
  velocitySizeInfluence?: number

  /** 描画速度による不透明度への影響度 (0.0-1.0) */
  velocityOpacityInfluence?: number

  /** 最小サイズ制限 (0.0-1.0, ブラシサイズに対する割合) */
  minSizeRatio?: number

  /** 最小不透明度制限 (0.0-1.0) */
  minOpacity?: number
}

/**
 * ドロップシャドウアピアランスのパラメータ
 */
export interface DropShadowParams {
  /** 影の色 */
  color: RGBAColor
  /** X方向のオフセット */
  offsetX: number
  /** Y方向のオフセット */
  offsetY: number
  /** ぼかしの半径 */
  blurRadius: number
  /** 影の広がり */
  spread?: number
  /** 不透明度（0-1） */
  opacity: number
  /** ブレンドモード */
  blendMode: BlendMode
}

/**
 * エフェクトID定数
 */
export const EFFECT_IDS = {
  FILL: 'fill',
  STROKE: 'stroke',
  DROP_SHADOW: 'drop-shadow',
} as const

/**
 * タイプ安全なアピアランス型（型ガード用）
 */
export type FillAppearance = BaseAppearance<FillParams> & {
  effectId: typeof EFFECT_IDS.FILL
}

export type StrokeAppearance = BaseAppearance<StrokeParams> & {
  effectId: typeof EFFECT_IDS.STROKE
}

export type DropShadowAppearance = BaseAppearance<DropShadowParams> & {
  effectId: typeof EFFECT_IDS.DROP_SHADOW
}

/**
 * すべてのアピアランスタイプの統合型
 */
export type Appearance =
  | FillAppearance
  | StrokeAppearance
  | DropShadowAppearance

/**
 * 型ガード関数群
 */
export function isFillAppearance(
  appearance: BaseAppearance,
): appearance is FillAppearance {
  return appearance.effectId === EFFECT_IDS.FILL
}

export function isStrokeAppearance(
  appearance: BaseAppearance,
): appearance is StrokeAppearance {
  return appearance.effectId === EFFECT_IDS.STROKE
}

export function isDropShadowAppearance(
  appearance: BaseAppearance,
): appearance is DropShadowAppearance {
  return appearance.effectId === EFFECT_IDS.DROP_SHADOW
}

/**
 * 単色塗りアピアランス作成用パラメータ
 */
export interface CreateSolidFillParams {
  color: RGBAColor
  opacity?: number
  blendMode?: BlendMode
  enabled?: boolean
}

/**
 * グラデーション塗りアピアランス作成用パラメータ
 */
export interface CreateGradientFillParams {
  gradient: Gradient
  opacity?: number
  blendMode?: BlendMode
  enabled?: boolean
}

/**
 * ドロップシャドウアピアランス作成用パラメータ
 */
export interface CreateDropShadowParams {
  color: RGBAColor
  offsetX: number
  offsetY: number
  blurRadius: number
  spread?: number
  opacity?: number
  blendMode?: BlendMode
  enabled?: boolean
}

/**
 * 単色塗りアピアランス作成ファクトリー関数
 */
export function createSolidFill(params: CreateSolidFillParams): FillAppearance {
  return {
    uid: generateUid() as UUID,
    enabled: params.enabled !== false,
    effectId: EFFECT_IDS.FILL,
    params: {
      fillType: 'solid',
      color: params.color,
      opacity: params.opacity ?? 1,
      blendMode: params.blendMode || 'normal',
    },
  }
}

/**
 * グラデーション塗りアピアランス作成ファクトリー関数
 */
export function createGradientFillAppearance(
  params: CreateGradientFillParams,
): FillAppearance {
  return {
    uid: generateUid() as UUID,
    enabled: params.enabled !== false,
    effectId: EFFECT_IDS.FILL,
    params: {
      fillType: 'gradient',
      gradient: params.gradient,
      opacity: params.opacity ?? 1,
      blendMode: params.blendMode || 'normal',
    },
  }
}

/**
 * 線アピアランス作成ファクトリー関数
 */
export function createStrokeAppearance(
  params: StrokeParams & { enabled?: boolean },
): StrokeAppearance {
  return {
    uid: generateUid() as UUID,
    enabled: params.enabled !== false,
    effectId: EFFECT_IDS.STROKE,
    params: {
      width: params.width,
      color: params.color,
      style: params.style || 'solid',
      dashPattern: params.dashPattern,
      lineCap: params.lineCap || 'round',
      lineJoin: params.lineJoin || 'round',
      miterLimit: params.miterLimit || 10,
      opacity: params.opacity ?? 1,
      blendMode: params.blendMode || 'normal',
      brushSettings: params.brushSettings,
    },
  }
}

/**
 * ドロップシャドウアピアランス作成ファクトリー関数
 */
export function createDropShadow(
  params: CreateDropShadowParams,
): DropShadowAppearance {
  return {
    uid: generateUid() as UUID,
    enabled: params.enabled !== false,
    effectId: EFFECT_IDS.DROP_SHADOW,
    params: {
      color: params.color,
      offsetX: params.offsetX,
      offsetY: params.offsetY,
      blurRadius: params.blurRadius,
      spread: params.spread || 0,
      opacity: params.opacity ?? 1,
      blendMode: params.blendMode || 'normal',
    },
  }
}

/**
 * デフォルトの黒い線アピアランスを作成
 */
export function createDefaultStroke(): StrokeAppearance {
  return createStrokeAppearance({
    width: 2,
    color: { r: 0, g: 0, b: 0, a: 1 },
    style: 'solid',
    lineCap: 'round',
    lineJoin: 'round',
    opacity: 1,
    blendMode: 'normal',
  })
}

/**
 * デフォルトの白い塗りアピアランスを作成
 */
export function createDefaultFill(): FillAppearance {
  return createSolidFill({
    color: { r: 1, g: 1, b: 1, a: 1 },
  })
}
