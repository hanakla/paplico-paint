/** Whats do this???? */
export function getUnitVector(x1: number, y1: number, x2: number, y2: number) {
  const vector = { x: x2 - x1, y: y2 - y1 }
  const magnitude = Math.hypot(x2 - x1, y2 - y1)

  vector.x /= magnitude
  vector.y /= magnitude

  return vector
}

export function getRadianTangent(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  return Math.atan2(y2 - y1, x2 - x1)
}
