export type VectorPath = {
  points: VectorPathPoint[]
  fillRule: 'nonzero' | 'evenodd'
  randomSeed: number
}

export type VectorPathPoints = {
  points: VectorPathPoint[]
}

export type TypeStrictVectorPathPoint =
  | {
      isMoveTo: true
      x: number
      y: number
    }
  | {
      isClose: true
      // unneeded but required for compatibility
      x: number
      y: number
    }
  | {
      /** if it undefined, this point not should be moveto */
      isMoveTo?: false

      /**
       * if it undefined, this point not should be Z
       * Ignore another attributes
       */
      isClose?: false

      // SEE: https://svgwg.org/svg2-draft/paths.html#PathDataCubicBezierCommands
      /** Absolute position(x1, y1), control point for beginning of curve */
      begin?: { x: number; y: number } | null
      /** Absolute position(x2, y2), control point for end of curve */
      end?: { x: number; y: number } | null

      /** Absolute position on canvas */
      x: number

      /** Absolute position on canvas */
      y: number

      /** 0 to 1 defaults to should be 1 */
      pressure?: number | null

      /** milliseconds to this point from previous point */
      deltaTime?: number | null

      tilt?: { x: number; y: number } | null
    }

export type VectorPathPoint = {
  // SEE: https://svgwg.org/svg2-draft/paths.html#PathDataCubicBezierCommands
  /** Absolute position(x1, y1), control point for beginning of curve */
  begin?: { x: number; y: number } | null
  /** Absolute position(x2, y2), control point for end of curve */
  end?: { x: number; y: number } | null

  /** Absolute position on canvas */
  x: number

  /** Absolute position on canvas */
  y: number

  /** 0 to 1 defaults to should be 1 */
  pressure?: number | null

  /** milliseconds to this point from previous point */
  deltaTime?: number | null

  tilt?: { x: number; y: number } | null

  /** if it undefined, this point not should be moveto */
  isMoveTo?: boolean

  /**
   * if it undefined, this point not should be Z
   * Ignore another attributes
   */
  isClose?: boolean
}
