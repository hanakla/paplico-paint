/** Get tangent from two points (x1, x2 and x2, y2) */
export function getTangent(x1: number, y1: number, x2: number, y2: number) {
  const vector = { x: x2 - x1, y: y2 - y1 }
  const magnitude = Math.hypot(x2 - x1, y2 - y1)

  vector.x /= magnitude
  vector.y /= magnitude

  return vector
}
