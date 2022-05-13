import { Color } from './Value'

export const normalRgbToRawRgb = (rgb: Color.RGBColor) => {
  return {
    r: Math.round(rgb.r * 255),
    g: Math.round(rgb.g * 255),
    b: Math.round(rgb.b * 255),
  }
}

export const rawRGBtoNormalRgb = (rgb: {
  r: number
  g: number
  b: number
}): Color.RGBColor => {
  return {
    r: rgb.r / 255,
    g: rgb.g / 255,
    b: rgb.b / 255,
  }
}
