const normalizeDegree = (angle: number) => {
  const norm = angle % 360
  return norm < 0 ? norm + 360 : norm
}

type DegreeNumber = number & { __degree: true }
const radToDeg = (rad: number) =>
  normalizeDegree((rad * 180) / Math.PI) as DegreeNumber

const deg = (num: number) => num as DegreeNumber

type RadianNumber = number & { __radiun: true }
const degToRad = (deg: DegreeNumber) =>
  (normalizeDegree(deg) * (Math.PI / 180)) as RadianNumber

/** Calc angle by p1 and p2 */
const angleOfPoints = (
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) => Math.atan2(p2.y - p1.y, p2.x - p1.x) as RadianNumber

const distanceOfPoint = (
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) => Math.hypot(p2.x - p1.x, p2.y - p1.y)

/** Calc position by angle and distance */
const pointByAngleAndDistance = ({
  angle,
  distance,
  base = { x: 0, y: 0 },
}: {
  angle: RadianNumber
  distance: number
  base?: { x: number; y: number }
}) => ({
  x: base.x + Math.cos(angle) * distance,
  y: base.y + Math.sin(angle) * distance,
})

const clamp = (x: number, min: number, max: number) =>
  Math.max(min, Math.min(x, max))

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const SilkWebMath = {
  deg,
  normalizeDegree,
  radToDeg,
  degToRad,
  angleOfPoints,
  distanceOfPoint,
  pointByAngleAndDistance,
  clamp,
  lerp,
}
