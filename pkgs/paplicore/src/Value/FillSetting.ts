export type ColorStop1D = {
  /** 0 to 1 */
  position: number
  /** 0..1 */
  color: {
    /** 0..1 */
    r: number
    /** 0..1 */
    g: number
    /** 0..1 */
    b: number
    /** 0..1 */
    a: number
  }
}

export type FillSetting =
  | {
      type: 'fill'
      color: {
        /** 0..1 */
        r: number
        /** 0..1 */
        g: number
        /** 0..1 */
        b: number
      }
      /** 0 to 1 */
      opacity: number
    }
  | {
      type: 'linear-gradient'
      colorStops: ColorStop1D[]
      /** 0 to 1 */
      opacity: number
      /** from center of bounding rect of current path */
      start: { x: number; y: number }
      /** from center of bounding rect of current path */
      end: { x: number; y: number }
    }
