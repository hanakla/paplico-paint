import { UIStrokePoint } from '@/UI/UIStroke'
import { VectorPathPoints } from '@/Document/LayerEntity/VectorPath'

export const splinePoints = (
  points: UIStrokePoint[],
  isClosedCurve = false
): VectorPathPoints => {
  const n = points.length

  if (n < 3)
    return {
      points: points.map((p): VectorPathPoints['points'][0] => ({
        x: p.x,
        y: p.y,
        in: null,
        out: null,
        deltaTime: p.deltaTimeMs,
        pressure: p.pressure,
        tilt: p.tilt ?? { x: 0, y: 0 },
      })),
    }

  let p0 = isClosedCurve ? points[n - 1] : points[0]
  let p1 = points[0]
  let p2 = points[1]
  let p3 = points[2]
  let pts = [points[0]]

  for (let i = 1; i < n; i++) {
    pts.push([])
  }

  return pts
}
