import { memo, useState, useRef, useCallback } from 'react'
import { useEventCallback } from '@paplico/shared-lib/react'
import { Button } from './ui/button'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { cn } from '@/lib/utils'
import type { RGBAColor } from '@/engine/document/types'

export interface ColorSliderProps {
  value: RGBAColor
  onChange: (color: RGBAColor) => void
  className?: string
}

export const ColorSlider = memo(function ColorSlider({
  value,
  onChange,
  className,
}: ColorSliderProps) {
  const [mode, setMode] = useState<ColorMode>('rgb')

  const hsb = rgbaToHsb(value)
  const lch = rgbaToLch(value)

  const handleRgbChange = useEventCallback(
    (component: 'r' | 'g' | 'b' | 'a', newValue: number) => {
      onChange({
        ...value,
        [component]: newValue / (component === 'a' ? 100 : 255),
      })
    },
  )

  const handleHsbChange = useEventCallback(
    (component: 'h' | 's' | 'b' | 'a', newValue: number) => {
      const newHsb = {
        ...hsb,
        [component]:
          component === 'h'
            ? newValue
            : component === 'a'
            ? newValue / 100
            : newValue / 100,
      }
      onChange(hsbToRgba(newHsb))
    },
  )

  const handleLchChange = useEventCallback(
    (component: 'l' | 'c' | 'h' | 'a', newValue: number) => {
      const newLch = {
        ...lch,
        [component]: component === 'a' ? newValue / 100 : newValue,
      }
      onChange(lchToRgba(newLch))
    },
  )

  const colorPreview = `rgba(${Math.round(value.r * 255)}, ${Math.round(
    value.g * 255,
  )}, ${Math.round(value.b * 255)}, ${value.a})`

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(['rgb', 'hsb', 'lch'] as const).map((m) => (
            <Button
              key={m}
              variant={mode === m ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode(m)}
              className="text-xs px-2 h-6"
            >
              {m.toUpperCase()}
            </Button>
          ))}
        </div>
        <div
          className="w-8 h-6 rounded border"
          style={{ backgroundColor: colorPreview }}
        />
      </div>

      {mode === 'rgb' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">R</Label>
            <GradientSlider
              value={value.r * 255}
              onValueChange={(v) => handleRgbChange('r', v)}
              max={255}
              step={1}
              className="flex-1"
              gradientStops={generateRgbGradient('r', value)}
            />
            <Input
              type="number"
              value={Math.round(value.r * 255)}
              onChange={(e) => handleRgbChange('r', Number(e.target.value))}
              min={0}
              max={255}
              className="w-16 h-6 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">G</Label>
            <GradientSlider
              value={value.g * 255}
              onValueChange={(v) => handleRgbChange('g', v)}
              max={255}
              step={1}
              className="flex-1"
              gradientStops={generateRgbGradient('g', value)}
            />
            <Input
              type="number"
              value={Math.round(value.g * 255)}
              onChange={(e) => handleRgbChange('g', Number(e.target.value))}
              min={0}
              max={255}
              className="w-16 h-6 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">B</Label>
            <GradientSlider
              value={value.b * 255}
              onValueChange={(v) => handleRgbChange('b', v)}
              max={255}
              step={1}
              className="flex-1"
              gradientStops={generateRgbGradient('b', value)}
            />
            <Input
              type="number"
              value={Math.round(value.b * 255)}
              onChange={(e) => handleRgbChange('b', Number(e.target.value))}
              min={0}
              max={255}
              className="w-16 h-6 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">A</Label>
            <GradientSlider
              value={value.a * 100}
              onValueChange={(v) => handleRgbChange('a', v)}
              max={100}
              step={1}
              className="flex-1"
              gradientStops={generateAlphaGradient(value)}
            />
            <Input
              type="number"
              value={Math.round(value.a * 100)}
              onChange={(e) => handleRgbChange('a', Number(e.target.value))}
              min={0}
              max={100}
              className="w-16 h-6 text-xs"
            />
          </div>
        </div>
      )}

      {mode === 'hsb' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">H</Label>
            <GradientSlider
              value={hsb.h}
              onValueChange={(v) => handleHsbChange('h', v)}
              max={360}
              step={1}
              className="flex-1"
              gradientStops={generateHsbGradient('h', hsb)}
            />
            <Input
              type="number"
              value={Math.round(hsb.h)}
              onChange={(e) => handleHsbChange('h', Number(e.target.value))}
              min={0}
              max={360}
              className="w-16 h-6 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">S</Label>
            <GradientSlider
              value={hsb.s * 100}
              onValueChange={(v) => handleHsbChange('s', v)}
              max={100}
              step={1}
              className="flex-1"
              gradientStops={generateHsbGradient('s', hsb)}
            />
            <Input
              type="number"
              value={Math.round(hsb.s * 100)}
              onChange={(e) => handleHsbChange('s', Number(e.target.value))}
              min={0}
              max={100}
              className="w-16 h-6 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">B</Label>
            <GradientSlider
              value={hsb.b * 100}
              onValueChange={(v) => handleHsbChange('b', v)}
              max={100}
              step={1}
              className="flex-1"
              gradientStops={generateHsbGradient('b', hsb)}
            />
            <Input
              type="number"
              value={Math.round(hsb.b * 100)}
              onChange={(e) => handleHsbChange('b', Number(e.target.value))}
              min={0}
              max={100}
              className="w-16 h-6 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">A</Label>
            <GradientSlider
              value={hsb.a * 100}
              onValueChange={(v) => handleHsbChange('a', v)}
              max={100}
              step={1}
              className="flex-1"
              gradientStops={generateAlphaGradient(value)}
            />
            <Input
              type="number"
              value={Math.round(hsb.a * 100)}
              onChange={(e) => handleHsbChange('a', Number(e.target.value))}
              min={0}
              max={100}
              className="w-16 h-6 text-xs"
            />
          </div>
        </div>
      )}

      {mode === 'lch' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">H</Label>
            <GradientSlider
              value={lch.h}
              onValueChange={(v) => handleLchChange('h', v)}
              max={360}
              step={1}
              className="flex-1"
              gradientStops={generateLchGradient('h', lch)}
            />
            <Input
              type="number"
              value={Math.round(lch.h)}
              onChange={(e) => handleLchChange('h', Number(e.target.value))}
              min={0}
              max={360}
              className="w-16 h-6 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">C</Label>
            <GradientSlider
              value={lch.c}
              onValueChange={(v) => handleLchChange('c', v)}
              max={100}
              step={1}
              className="flex-1"
              gradientStops={generateLchGradient('c', lch)}
            />
            <Input
              type="number"
              value={Math.round(lch.c)}
              onChange={(e) => handleLchChange('c', Number(e.target.value))}
              min={0}
              max={100}
              className="w-16 h-6 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">L</Label>
            <GradientSlider
              value={lch.l}
              onValueChange={(v) => handleLchChange('l', v)}
              max={100}
              step={1}
              className="flex-1"
              gradientStops={generateLchGradient('l', lch)}
            />
            <Input
              type="number"
              value={Math.round(lch.l)}
              onChange={(e) => handleLchChange('l', Number(e.target.value))}
              min={0}
              max={100}
              className="w-16 h-6 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-3">A</Label>
            <GradientSlider
              value={lch.a * 100}
              onValueChange={(v) => handleLchChange('a', v)}
              max={100}
              step={1}
              className="flex-1"
              gradientStops={generateAlphaGradient(value)}
            />
            <Input
              type="number"
              value={Math.round(lch.a * 100)}
              onChange={(e) => handleLchChange('a', Number(e.target.value))}
              min={0}
              max={100}
              className="w-16 h-6 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  )
})

// Helper types and functions
type ColorMode = 'rgb' | 'hsb' | 'lch'

interface HSBColor {
  h: number // 0-360
  s: number // 0-1
  b: number // 0-1
  a: number // 0-1
}

interface LCHColor {
  l: number // 0-100
  c: number // 0-100+
  h: number // 0-360
  a: number // 0-1
}

interface GradientSliderProps {
  value: number
  onValueChange: (value: number) => void
  max: number
  step?: number
  className?: string
  gradientStops: string[]
}

const GradientSlider = memo(function GradientSlider({
  value,
  onValueChange,
  max,
  step = 1,
  className,
  gradientStops,
}: GradientSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    updateValue(e)

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      if (isDragging.current) {
        updateValue(e as any)
      }
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  const updateValue = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!sliderRef.current) return

      const rect = sliderRef.current.getBoundingClientRect()
      const percentage = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      )
      const newValue = Math.round((percentage * max) / step) * step
      onValueChange(newValue)
    },
    [max, step, onValueChange],
  )

  const percentage = (value / max) * 100
  const gradientBackground = `linear-gradient(to right, ${gradientStops.join(
    ', ',
  )})`

  return (
    <div className={cn('relative w-full', className)}>
      <div
        ref={sliderRef}
        className="h-4 w-full rounded cursor-pointer"
        style={{ background: gradientBackground }}
        onMouseDown={handleMouseDown}
      />
      <div
        className="absolute top-4 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-white transform -translate-x-1/2 cursor-grab active:cursor-grabbing"
        style={{
          left: `${percentage}%`,
          filter: 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3))',
        }}
        onMouseDown={handleMouseDown}
      />
    </div>
  )
})

function rgbaToHsb(rgba: RGBAColor): HSBColor {
  const { r, g, b, a } = rgba
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min
  let h = 0
  const s = max === 0 ? 0 : diff / max
  const brightness = max

  if (diff !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) * 60
        break
      case g:
        h = ((b - r) / diff + 2) * 60
        break
      case b:
        h = ((r - g) / diff + 4) * 60
        break
    }
  }
  return { h, s, b: brightness, a }
}

function hsbToRgba(hsb: HSBColor): RGBAColor {
  const { h, s, b, a } = hsb
  const c = b * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = b - c
  let r = 0,
    g = 0,
    blue = 0

  if (h >= 0 && h < 60) {
    r = c
    g = x
    blue = 0
  } else if (h >= 60 && h < 120) {
    r = x
    g = c
    blue = 0
  } else if (h >= 120 && h < 180) {
    r = 0
    g = c
    blue = x
  } else if (h >= 180 && h < 240) {
    r = 0
    g = x
    blue = c
  } else if (h >= 240 && h < 300) {
    r = x
    g = 0
    blue = c
  } else if (h >= 300 && h < 360) {
    r = c
    g = 0
    blue = x
  }

  return { r: r + m, g: g + m, b: blue + m, a }
}

function rgbaToLch(rgba: RGBAColor): LCHColor {
  const { r, g, b, a } = rgba
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const lr = toLinear(r),
    lg = toLinear(g),
    lb = toLinear(b)

  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175
  const z = lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041

  const xn = 0.95047,
    yn = 1.0,
    zn = 1.08883
  const fx =
    x / xn > 0.008856 ? Math.pow(x / xn, 1 / 3) : (7.787 * x) / xn + 16 / 116
  const fy =
    y / yn > 0.008856 ? Math.pow(y / yn, 1 / 3) : (7.787 * y) / yn + 16 / 116
  const fz =
    z / zn > 0.008856 ? Math.pow(z / zn, 1 / 3) : (7.787 * z) / zn + 16 / 116

  const L = 116 * fy - 16
  const aLab = 500 * (fx - fy)
  const bLab = 200 * (fy - fz)
  const C = Math.sqrt(aLab * aLab + bLab * bLab)
  let H = (Math.atan2(bLab, aLab) * 180) / Math.PI
  if (H < 0) H += 360

  return { l: L, c: C, h: H, a }
}

function lchToRgba(lch: LCHColor): RGBAColor {
  const { l: L, c: C, h: H, a } = lch
  const aLab = C * Math.cos((H * Math.PI) / 180)
  const bLab = C * Math.sin((H * Math.PI) / 180)

  const fy = (L + 16) / 116
  const fx = aLab / 500 + fy
  const fz = fy - bLab / 200

  const xn = 0.95047,
    yn = 1.0,
    zn = 1.08883
  const x = (fx > 0.206897 ? fx * fx * fx : (fx - 16 / 116) / 7.787) * xn
  const y = (fy > 0.206897 ? fy * fy * fy : (fy - 16 / 116) / 7.787) * yn
  const z = (fz > 0.206897 ? fz * fz * fz : (fz - 16 / 116) / 7.787) * zn

  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
  let g = x * -0.969266 + y * 1.8760108 + z * 0.041556
  let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252

  r = Math.max(0, Math.min(1, r))
  g = Math.max(0, Math.min(1, g))
  b = Math.max(0, Math.min(1, b))

  const fromLinear = (c: number) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return { r: fromLinear(r), g: fromLinear(g), b: fromLinear(b), a }
}

function generateRgbGradient(
  component: 'r' | 'g' | 'b',
  currentColor: RGBAColor,
): string[] {
  const result: string[] = []
  for (let i = 0; i <= 10; i++) {
    const color = { ...currentColor, [component]: i / 10 }
    result.push(
      `rgb(${Math.round(color.r * 255)}, ${Math.round(
        color.g * 255,
      )}, ${Math.round(color.b * 255)})`,
    )
  }
  return result
}

function generateAlphaGradient(currentColor: RGBAColor): string[] {
  const result: string[] = []
  for (let i = 0; i <= 10; i++) {
    const alpha = i / 10
    result.push(
      `rgba(${Math.round(currentColor.r * 255)}, ${Math.round(
        currentColor.g * 255,
      )}, ${Math.round(currentColor.b * 255)}, ${alpha})`,
    )
  }
  return result
}

function generateHsbGradient(
  component: 'h' | 's' | 'b',
  currentHsb: HSBColor,
): string[] {
  const result: string[] = []
  for (let i = 0; i <= 10; i++) {
    let newHsb: HSBColor
    if (component === 'h') newHsb = { ...currentHsb, h: ((i / 10) * 360) % 360 }
    else if (component === 's') newHsb = { ...currentHsb, s: i / 10 }
    else newHsb = { ...currentHsb, b: i / 10 }

    const rgba = hsbToRgba(newHsb)
    result.push(
      `rgb(${Math.round(rgba.r * 255)}, ${Math.round(
        rgba.g * 255,
      )}, ${Math.round(rgba.b * 255)})`,
    )
  }
  return result
}

function generateLchGradient(
  component: 'l' | 'c' | 'h',
  currentLch: LCHColor,
): string[] {
  const result: string[] = []
  for (let i = 0; i <= 10; i++) {
    let newLch: LCHColor
    if (component === 'l') newLch = { ...currentLch, l: (i / 10) * 100 }
    else if (component === 'c') newLch = { ...currentLch, c: (i / 10) * 100 }
    else newLch = { ...currentLch, h: (i / 10) * 360 }

    const rgba = lchToRgba(newLch)
    result.push(
      `rgb(${Math.round(rgba.r * 255)}, ${Math.round(
        rgba.g * 255,
      )}, ${Math.round(rgba.b * 255)})`,
    )
  }
  return result
}
