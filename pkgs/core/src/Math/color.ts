// @author GPT-4
export function hsvToRgb(
  h: number,
  s: number,
  v: number
): [number, number, number] {
  let r: number, g: number, b: number

  const i: number = Math.floor(h * 6)
  const f: number = h * 6 - i
  const p: number = v * (1 - s)
  const q: number = v * (1 - f * s)
  const t: number = v * (1 - (1 - f) * s)

  switch (i % 6) {
    case 0:
      r = v
      g = t
      b = p
      break
    case 1:
      r = q
      g = v
      b = p
      break
    case 2:
      r = p
      g = v
      b = t
      break
    case 3:
      r = p
      g = q
      b = v
      break
    case 4:
      r = t
      g = p
      b = v
      break
    case 5:
      r = v
      g = p
      b = q
      break
    default:
      throw new Error('Invalid HSV color')
  }

  return [r, g, b]
}

// @author GPT-4
export function rgbToHsv(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  // find the maximum and minimum values of the RGB components
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)

  let h = 0
  let s = 0
  let v = max

  const delta = max - min

  // calculate the saturation of the color
  if (max !== 0) {
    s = delta / max
  }

  // calculate the hue of the color
  if (delta !== 0) {
    if (max === r) {
      h = (g - b) / delta + (g < b ? 6 : 0)
    } else if (max === g) {
      h = (b - r) / delta + 2
    } else {
      h = (r - g) / delta + 4
    }
    h /= 6
  }

  // return the hue, saturation, and value of the color as an array
  // hue is in the range [0, 1]
  // saturation is in the range [0, 1]
  // value is in the range [0, 1]
  return [h, s, v]
}
