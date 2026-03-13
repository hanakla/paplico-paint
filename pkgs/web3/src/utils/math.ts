export const clamp = (v: number, min: number, max: number) => {
  return Math.min(Math.max(v, min), max)
}

export const roundPrecision = (v: number, precision: number) => {
  const p = Math.pow(10, precision)
  return Math.round(v * p) / p
}
