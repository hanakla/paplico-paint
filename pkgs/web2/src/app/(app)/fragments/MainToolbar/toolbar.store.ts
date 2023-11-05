import { ColorTypes, hsbaToRGBA } from '@/components/ColorPicker'
import { Document } from '@paplico/core-new'
import { rgbToColorString } from 'polished'
import { create } from 'zustand'

type ToolbarStore = {
  strokeColorHSB: ColorTypes.HSBA
  strokeColorString: string

  set: (state: Partial<ToolbarStore>) => void
  get: () => ToolbarStore
}

export const useToolbarStore = create<ToolbarStore>((set, get) => ({
  strokeColorHSB: { h: 0, s: 0, b: 0 },
  get strokeColorString() {
    const color = hsbaToRGBA(get().strokeColorHSB)
    return rgbToColorString({
      red: color.r,
      green: color.g,
      blue: color.b,
    })
  },

  set,
  get,
}))

export function papColorToRGBA(
  color: Document.ColorRGB | Document.ColorRGBA,
): ColorTypes.RGBA {
  return {
    r: color.r * 255,
    g: color.g * 255,
    b: color.b * 255,
    a: 'a' in color ? color.a : undefined,
  }
}

export function rgbaToPapColor(color: {
  r: number
  g: number
  b: number
  a?: number
}) {
  return {
    r: color.r / 255,
    g: color.g / 255,
    b: color.b / 255,
    a: color.a ?? 1,
  }
}
