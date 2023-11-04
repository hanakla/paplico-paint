export function getPointWithAngleAndDistance({
  angle,
  distance,
  base = { x: 0, y: 0 },
}: {
  /** radian number */
  angle: number
  distance: number
  base?: { x: number; y: number }
}) {
  return {
    x: base.x + Math.cos(angle) * distance,
    y: base.y + Math.sin(angle) * distance,
  }
}
