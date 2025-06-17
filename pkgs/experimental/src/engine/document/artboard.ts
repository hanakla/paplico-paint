import { UUID, Bounds, RGBAColor } from './types'

/**
 * アートボード：描画領域の定義
 * キャンバス上の特定の矩形領域を表す
 */
export interface Artboard {
  id: UUID
  name: string
  /** アートボードのキャンバス上での位置とサイズ */
  bounds: Bounds
  /** 背景色（透明な場合はnull） */
  backgroundColor?: RGBAColor | null
  /** 表示・非表示 */
  visible: boolean
  /** ロック状態 */
  locked: boolean
}

/**
 * アートボード作成用のパラメータ
 */
export interface CreateArtboardParams {
  name?: string
  x?: number
  y?: number
  width: number
  height: number
  backgroundColor?: RGBAColor | null
  visible?: boolean
  locked?: boolean
}

/**
 * アートボード作成ファクトリー関数
 */
export function createArtboard(params: CreateArtboardParams): Artboard {
  return {
    id: crypto.randomUUID(),
    name: params.name || 'Artboard',
    bounds: {
      x: params.x || 0,
      y: params.y || 0,
      width: params.width,
      height: params.height,
    },
    backgroundColor: params.backgroundColor || null,
    visible: params.visible !== false,
    locked: params.locked || false,
  }
}

/**
 * アートボード内の座標かどうかを判定
 */
export function isPointInArtboard(
  artboard: Artboard,
  x: number,
  y: number,
): boolean {
  const { bounds } = artboard
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  )
}

/**
 * アートボードの中心座標を取得
 */
export function getArtboardCenter(artboard: Artboard): {
  x: number
  y: number
} {
  const { bounds } = artboard
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  }
}
