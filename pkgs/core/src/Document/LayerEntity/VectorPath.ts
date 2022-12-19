export type VectorPath = {
  points: VectorPathPoint[]
  randomSeed: number
  closed: boolean
}

export type VectorPathPoints = {
  points: VectorPathPoint[]
}

export type VectorPathPoint = {
  /** Relative position from point */
  in: { x: number; y: number } | null
  /** Relative position from point */
  out: { x: number; y: number } | null
  // c1x: number
  // c1y: number
  // c2x: number
  // c2y: number

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
