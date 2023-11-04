import { getTangent } from './getTangent'

export function getRadianFromTangent(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const vector = getTangent(x1, y1, x2, y2)
  const result = Math.atan2(vector.x, vector.y)
  return Number.isNaN(result) ? 0 : result
}
