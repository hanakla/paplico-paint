export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const normalizeDegree = (angle: number) => {
  const norm = angle % 360
  return norm < 0 ? norm + 360 : norm
}

export const radToDeg = (rad: number) => normalizeDegree((rad * 180) / Math.PI)
