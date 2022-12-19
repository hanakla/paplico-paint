export type VectorBrushSetting = {
  brushId: string
  brushVersion: string

  /** Should be px */
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
