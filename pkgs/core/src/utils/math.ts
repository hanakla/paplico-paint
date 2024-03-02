export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const clamp = (v: number, min: number, max: number) => {
  return Math.min(Math.max(v, min), max)
}

const normalizeDegree = (angle: number) => {
  const norm = angle % 360
  return norm < 0 ? norm + 360 : norm
}

export const radToDeg = (rad: number) => normalizeDegree((rad * 180) / Math.PI)

export const degToRad = (deg: number) => normalizeDegree(deg) * (Math.PI / 180)

export const suppressNaN = (value: number, { to = 0 }: { to?: number }) =>
  Number.isNaN(value) ? to : value
