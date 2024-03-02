import caster from 'svg-path-bounding-box'

export function pathBounds(path: string): {
  left: number
  top: number
  right: number
  bottom: number
} {
  const result = caster(path)

  return {
    left: result.minX,
    top: result.minY,
    right: result.maxX,
    bottom: result.maxY,
  }
}
