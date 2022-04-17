export type ColorStop = {
  /** 0 to 1 */
  position: number
  /** 0..1 */
  color: {
    r: number
    g: number
    b: number
    a: number
  }
}

export type FillSetting =
  | {
      type: 'fill'
      color: { r: number; g: number; b: number }
      /** 0 to 1 */
      opacity: number
    }
  | {
      type: 'linear-gradient'
      colorStops: ColorStop[]
      /** 0 to 1 */
      opacity: number
      /** from center of bounding rect of current path */
      start: { x: number; y: number }
      /** from center of bounding rect of current path */
      end: { x: number; y: number }
    }
