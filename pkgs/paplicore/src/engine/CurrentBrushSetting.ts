export type CurrentBrushSetting = {
  brushId: string
  /** 0 to 100 */
  size: number
  color: {
    /** 0 to 1 */
    r: number
    /** 0 to 1 */
    g: number
    /** 0 to 1 */
    b: number
  }
  /** 0 to 1 */
  opacity: number

  /** Brush renderer specific settings */
  specific: Record<string, any> | null
}
