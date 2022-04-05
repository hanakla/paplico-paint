export type BrushSetting = {
  brushId: string
  /** 0 to 100 */
  size: number
  color: { r: number; g: number; b: number }

  /** 0 to 1 */
  opacity: number
}
