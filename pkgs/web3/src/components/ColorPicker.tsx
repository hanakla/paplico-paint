import { checkerBoard } from '@/utils/cssMixin'
import { useStableLatestRef } from '@/utils/hooks'
import { clamp } from '@/utils/math'
import { shallowEquals } from '@paplico/shared-lib'
import {
  CSSProperties,
  ComponentType,
  ForwardRefExoticComponent,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  forwardRef,
  memo,
  useMemo,
  useRef,
} from 'react'
import useEvent from 'react-use-event-hook'
import { css, styled } from 'styled-components'

export namespace ColorTypes {
  export type RGBA = {
    /** 0 to 255 */
    r: number
    /** 0 to 255 */
    g: number
    /** 0 to 255 */
    b: number
    /** 0 to 1 */
    a?: number
  }

  export type HSBA = {
    /** 0 to 360 */
    h: number
    /** 0 to 1 */
    s: number
    /** 0 to 1 */
    b: number
    /** 0 to 1 */
    a?: number
  }
}

export type ColorChangeHandler = (
  color: {
    rgb: ColorTypes.RGBA
    hsb: ColorTypes.HSBA
  },
  event: globalThis.PointerEvent | globalThis.KeyboardEvent,
) => void

export type CursorComponentType = ComponentType<{
  style?: CSSProperties
  color?: ColorTypes.HSBA
}>

type Props = {
  color: ColorTypes.RGBA | ColorTypes.HSBA
  className?: string
  Cursor?: CursorComponentType
  onChange?: ColorChangeHandler
  onChangeComplete?: ColorChangeHandler
}

const DefaultCursor: CursorComponentType = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'color',
})`
  height: 130%;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 1px black;
  aspect-ratio: 1;
  background-color: ${({ color }, hsl = hsvToHsl(color)) =>
    `hsl(${hsl.h}deg ${hsl.s * 100}% ${hsl.l * 100}% / ${hsl.a})`};
`

export const Hue = memo(function Hue({
  color,
  className,
  onChange,
  onChangeComplete,
  Cursor = DefaultCursor,
}: Props) {
  const hsba = useMemo(
    () => toHSBA(color),
    [
      (color as ColorTypes.RGBA).r,
      (color as ColorTypes.RGBA).g,
      color.b,
      (color as ColorTypes.HSBA).h,
      (color as ColorTypes.HSBA).s,
      color.a,
    ],
  )

  const hue = hsba.h / 360

  const cursorHsba = useMemo<ColorTypes.HSBA>(
    () => ({ h: hsba.h, s: 1, b: 1, a: 1 }),
    [hsba],
  )

  const handleOnChange = useEvent(
    (value: number, e: globalThis.PointerEvent | globalThis.KeyboardEvent) => {
      const nextHsb = { ...hsba, h: value * 360 }
      onChange?.({ rgb: hsbaToRGBA(nextHsb), hsb: nextHsb }, e)
    },
  )

  const handleOnChangeComplete = useEvent(
    (value: number, e: globalThis.PointerEvent | globalThis.KeyboardEvent) => {
      const nextHsb = { ...hsba, h: value * 360 }
      onChangeComplete?.({ rgb: hsbaToRGBA(nextHsb), hsb: nextHsb }, e)
    },
  )

  return (
    <SingleSlider
      Component={HueSlider}
      Cursor={Cursor}
      className={className}
      value={hue}
      max={1}
      min={0}
      aria-label="Color hue"
      color={hsba}
      cursorColor={cursorHsba}
      onChange={handleOnChange}
      onChangeComplete={handleOnChangeComplete}
    />
  )
}, propsAreEquals)

const HueSlider = forwardRef<HTMLDivElement, SliderRendererProps>(
  (props, ref) => (
    <div
      ref={ref}
      css={css`
        position: relative;
        display: block;
        width: 100%;
        height: 14px;
        background: linear-gradient(
          to right,
          rgb(255, 0, 0) 0%,
          rgb(255, 255, 0) 17%,
          rgb(0, 255, 0) 33%,
          rgb(0, 255, 255) 50%,
          rgb(0, 0, 255) 67%,
          rgb(255, 0, 255) 83%,
          rgb(255, 0, 0) 100%
        );
      `}
      {...props}
    />
  ),
)

export const SatAndBright = memo(function HueSaturation({
  color,
  className,
  onChange,
  onChangeComplete,
  Cursor = DefaultCursor,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const cursorRef = useRef<HTMLDivElement | null>(null)

  const hsba = useMemo(
    () => toHSBA(color),
    [
      (color as ColorTypes.RGBA).r,
      (color as ColorTypes.RGBA).g,
      color.b,
      (color as ColorTypes.HSBA).h,
      (color as ColorTypes.HSBA).s,
      color.a,
    ],
  )

  const draggingRef = useRef(false)

  const getNextSaturation = useStableLatestRef((e: globalThis.PointerEvent) => {
    const parentWidth = rootRef.current!.clientWidth
    const parentHeight = rootRef.current!.clientHeight
    const parentBounds = rootRef.current!.getBoundingClientRect()
    const nextCursorLeft = e.clientX - parentBounds.left
    const nextCursorTop = e.clientY - parentBounds.top

    return {
      s: clamp(nextCursorLeft / parentWidth, 0, 1),
      b: clamp(1 - nextCursorTop / parentHeight, 0, 1),
    }
  })

  const handlePointerDown = useEvent((e: PointerEvent) => {
    draggingRef.current = true
    const { s, b } = getNextSaturation.current(e.nativeEvent)
    const nextHsb = { ...hsba, s, b }

    onChange?.({ rgb: hsbaToRGBA(nextHsb), hsb: nextHsb }, e.nativeEvent)

    window.addEventListener('pointermove', handleWindowPointerMove, {
      passive: true,
    })
    window.addEventListener('pointerup', handleWindowPointerUp, {
      passive: true,
    })
  })

  const handleKeyDown = useEvent((e: KeyboardEvent) => {
    if (
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowRight' &&
      e.key !== 'ArrowUp' &&
      e.key !== 'ArrowDown'
    )
      return

    const amount = e.shiftKey ? 0.1 : 0.01

    const nextS = clamp(
      hsba.s +
        (e.key === 'ArrowLeft' ? -amount : e.key === 'ArrowRight' ? amount : 0),
      0,
      1,
    )

    const nextB = clamp(
      hsba.b +
        (e.key === 'ArrowDown' ? -amount : e.key === 'ArrowUp' ? amount : 0),
      0,
      1,
    )

    const nextHsb = { ...hsba, s: nextS, b: nextB }

    if (e.repeat) {
      onChange?.({ rgb: hsbaToRGBA(nextHsb), hsb: nextHsb }, e.nativeEvent)
    } else {
      onChangeComplete?.(
        { rgb: hsbaToRGBA(nextHsb), hsb: nextHsb },
        e.nativeEvent,
      )
    }
  })

  const handleWindowPointerMove = useEvent((e: globalThis.PointerEvent) => {
    if (draggingRef.current === false) return

    const { s, b } = getNextSaturation.current(e)
    const nextHsb = { ...hsba, s, b }

    onChange?.({ rgb: hsbaToRGBA(nextHsb), hsb: nextHsb }, e)
  })

  const handleWindowPointerUp = useEvent((e: globalThis.PointerEvent) => {
    draggingRef.current = false

    onChangeComplete?.({ rgb: hsbaToRGBA(hsba), hsb: { ...hsba } }, e)

    window.removeEventListener('pointermove', handleWindowPointerMove)
    window.removeEventListener('pointerup', handleWindowPointerUp)
  })

  return (
    <div
      ref={rootRef}
      css={css`
        position: relative;
        display: block;
        width: 100%;
        height: 200px;
        background: hsl(${hsba.h}deg, 100%, 50%);
        touch-action: none;
      `}
      className={className}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      role="widget"
      aria-label="Color lightness and saturation"
      tabIndex={0}
    >
      <div
        css={css`
          position: relative;
          display: block;
          width: 100%;
          height: 100%;
          background: linear-gradient(
              to top,
              rgba(0, 0, 0, 1) 0%,
              rgba(0, 0, 0, 0) 100%
            ),
            linear-gradient(
              to right,
              rgba(255, 255, 255, 1) 0%,
              rgba(255, 255, 255, 0) 100%
            );
        `}
      >
        <div
          ref={cursorRef}
          style={{
            position: 'absolute',
            height: 12,
            left: `${hsba.s * 100}%`,
            top: `${(1 - hsba.b) * 100}%`,
            transform: 'translate(-50%, -50%)',
            userSelect: 'none',
          }}
        >
          <Cursor color={hsba} />
        </div>
      </div>
    </div>
  )
}, propsAreEquals)

export const Saturation = memo(function Saturation({
  color,
  className,
  onChange,
  onChangeComplete,
  Cursor = DefaultCursor,
}: Props) {
  const hsba = useMemo(
    () => toHSBA(color),
    [
      (color as ColorTypes.RGBA).r,
      (color as ColorTypes.RGBA).g,
      color.b,
      (color as ColorTypes.HSBA).h,
      (color as ColorTypes.HSBA).s,
      color.a,
    ],
  )

  const saturation = hsba.s

  const cursorHsba = useMemo<ColorTypes.HSBA>(
    () => ({ h: hsba.h, s: hsba.s, b: 1, a: 1 }),
    [hsba],
  )

  const handleOnChange = useEvent(
    (value: number, e: globalThis.PointerEvent | globalThis.KeyboardEvent) => {
      const nextHsb = { ...hsba, s: value }
      onChange?.({ rgb: hsbaToRGBA(nextHsb), hsb: nextHsb }, e)
    },
  )

  const handleOnChangeComplete = useEvent(
    (value: number, e: globalThis.PointerEvent | globalThis.KeyboardEvent) => {
      const nextHsb = { ...hsba, s: value }
      onChangeComplete?.({ rgb: hsbaToRGBA(nextHsb), hsb: nextHsb }, e)
    },
  )

  return (
    <SingleSlider
      Component={SaturationSlider}
      Cursor={Cursor}
      className={className}
      value={saturation}
      max={1}
      min={0}
      aria-label="Color saturation"
      color={hsba}
      cursorColor={cursorHsba}
      onChange={handleOnChange}
      onChangeComplete={handleOnChangeComplete}
    />
  )
}, propsAreEquals)

const SaturationSlider = forwardRef<HTMLDivElement, SliderRendererProps>(
  ({ color, ...props }, ref) => {
    return (
      <div
        ref={ref}
        css={css`
          position: relative;
          width: 100%;
          height: 14px;
        `}
        {...props}
        style={{
          background: `linear-gradient(
            to right,
            hsl(${color.h}deg, 0%, 100%) 0%,
            hsl(${color.h}deg, 100%, 50%) 100%
          )`,
          ...props.style,
        }}
      />
    )
  },
)

export const Brightness = memo(function Brightness({
  color,
  className,
  onChange,
  onChangeComplete,
  Cursor = DefaultCursor,
}: Props) {
  const hsba = useMemo(
    () => toHSBA(color),
    [
      (color as ColorTypes.RGBA).r,
      (color as ColorTypes.RGBA).g,
      color.b,
      (color as ColorTypes.HSBA).h,
      (color as ColorTypes.HSBA).s,
      color.a,
    ],
  )

  const brightness = hsba.b

  const cursorHsba = useMemo<ColorTypes.HSBA>(
    () => ({ h: hsba.h, s: 1, b: hsba.b, a: 1 }),
    [hsba],
  )

  const handleOnChange = useEvent(
    (value: number, e: globalThis.PointerEvent | globalThis.KeyboardEvent) => {
      const nextHsb = { ...hsba, b: value }
      onChange?.({ rgb: hsbaToRGBA(nextHsb), hsb: nextHsb }, e)
    },
  )

  const handleOnChangeComplete = useEvent(
    (value: number, e: globalThis.PointerEvent | globalThis.KeyboardEvent) => {
      const nextHsb = { ...hsba, b: value }
      onChangeComplete?.({ rgb: hsbaToRGBA(nextHsb), hsb: nextHsb }, e)
    },
  )

  return (
    <SingleSlider
      Component={BrightnessSlider}
      Cursor={Cursor}
      className={className}
      value={brightness}
      max={1}
      min={0}
      aria-label="Color brightness"
      color={hsba}
      cursorColor={cursorHsba}
      onChange={handleOnChange}
      onChangeComplete={handleOnChangeComplete}
    />
  )
}, propsAreEquals)

const BrightnessSlider = forwardRef<HTMLDivElement, SliderRendererProps>(
  ({ color, ...props }, ref) => {
    const hue = color.h

    return (
      <div
        ref={ref}
        css={css`
          position: relative;
          width: 100%;
          height: 14px;
          background: linear-gradient(
            to right,
            hsl(${hue}deg, 100%, 0%) 0%,
            hsl(${hue}deg, 100%, 50%) 50%
          );
        `}
        {...props}
      />
    )
  },
)

export const Alpha = memo(function Alpha({
  color,
  className,
  onChange,
  onChangeComplete,
  Cursor,
}: Props) {
  const hsba = useMemo(
    () => toHSBA(color),
    [
      (color as ColorTypes.RGBA).r,
      (color as ColorTypes.RGBA).g,
      color.b,
      (color as ColorTypes.HSBA).h,
      (color as ColorTypes.HSBA).s,
      color.a,
    ],
  )

  const alpha = hsba.a ?? 0

  const cursorHsba = useMemo<ColorTypes.HSBA>(
    () => ({ h: 0, s: 0, b: 0, a: alpha }),
    [hsba],
  )

  const handleOnChange = useEvent(
    (value: number, e: globalThis.PointerEvent | globalThis.KeyboardEvent) => {
      const nextHsb = { ...hsba, a: value }
      onChange?.({ rgb: hsbaToRGBA(nextHsb), hsb: nextHsb }, e)
    },
  )

  const handleOnChangeComplete = useEvent(
    (value: number, e: globalThis.PointerEvent | globalThis.KeyboardEvent) => {
      const nextHsb = { ...hsba, a: value }
      onChangeComplete?.({ rgb: hsbaToRGBA(nextHsb), hsb: nextHsb }, e)
    },
  )

  return (
    <SingleSlider
      Component={AlphaSlider}
      Cursor={Cursor}
      className={className}
      value={alpha}
      max={1}
      min={0}
      aria-label="Color alpha"
      aria-valuemax={1}
      aria-valuemin={0}
      aria-valuenow={alpha}
      color={hsba}
      cursorColor={cursorHsba}
      onChange={handleOnChange}
      onChangeComplete={handleOnChangeComplete}
    />
  )
})

const AlphaSlider = forwardRef<HTMLDivElement, SliderRendererProps>(
  ({ children, ...props }, ref) => (
    <div
      ref={ref}
      css={css`
        position: relative;
        display: block;
        width: 100%;
        height: 14px;
        background-image: linear-gradient(
            45deg,
            rgba(0, 0, 0, 0.2) 25%,
            transparent 25%,
            transparent 75%,
            rgba(0, 0, 0, 0.2) 75%
          ),
          linear-gradient(
            45deg,
            rgba(0, 0, 0, 0.2) 25%,
            transparent 25%,
            transparent 75%,
            rgba(0, 0, 0, 0.2) 75%
          );

        background-size: 10px 10px;
        background-position:
          0 0,
          5px 5px;
      `}
      {...props}
    >
      <div
        css={css`
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(0, 0, 0, 0) 0%,
            rgba(0, 0, 0, 1) 100%
          );
        `}
      >
        {children}
      </div>
    </div>
  ),
)

type SliderRendererProps = {
  className?: string
  onPointerDown: (e: PointerEvent) => void
  onKeyDown: (e: KeyboardEvent) => void
  role: string
  'aria-label': string
  'aria-valuemax': number
  'aria-valuemin': number
  'aria-valuenow': number
  tabIndex: number
  color: ColorTypes.HSBA
  children: ReactNode
}

const SingleSlider = memo(function SingleSlider({
  Component,
  Cursor = DefaultCursor,
  amount = 0.01,
  amountOnShift = 0.1,
  value,
  color,
  cursorColor,
  max,
  min,
  className,
  onChange,
  onChangeComplete,
  ...aria
}: {
  Component: ForwardRefExoticComponent<SliderRendererProps>
  Cursor?: CursorComponentType
  amount?: number
  amountOnShift?: number
  value: number
  max: number
  min: number
  className?: string
  'aria-label': string
  color: ColorTypes.HSBA
  cursorColor: ColorTypes.HSBA
  onChange: (
    value: number,
    event: globalThis.PointerEvent | globalThis.KeyboardEvent,
  ) => void
  onChangeComplete: (
    value: number,
    event: globalThis.PointerEvent | globalThis.KeyboardEvent,
  ) => void
}) {
  const rootRef = useRef<HTMLElement | null>(null)
  const cursorRef = useRef<HTMLElement | null>(null)

  const draggingRef = useRef(false)

  const getNextValue = useStableLatestRef((e: globalThis.PointerEvent) => {
    const parentWidth = rootRef.current!.clientWidth
    const parentBounds = rootRef.current!.getBoundingClientRect()
    const nextCursorLeft = e.clientX - parentBounds.left

    return clamp(nextCursorLeft / parentWidth, min, max)
  })

  const handlePointerDown = useEvent((e: PointerEvent) => {
    draggingRef.current = true

    onChange?.(getNextValue.current(e.nativeEvent), e.nativeEvent)

    window.addEventListener('pointermove', handleWindowPointerMove, {
      passive: true,
    })
    window.addEventListener('pointerup', handleWindowPointerUp, {
      passive: true,
    })
  })

  const handleKeyDown = useEvent((e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

    const usingAmount = e.shiftKey ? amountOnShift : amount
    const nextValue = clamp(
      value + (e.key === 'ArrowLeft' ? -usingAmount : usingAmount),
      min,
      max,
    )

    if (e.repeat) {
      onChange?.(nextValue, e.nativeEvent)
    } else {
      onChangeComplete?.(nextValue, e.nativeEvent)
    }
  })

  const handleWindowPointerMove = useEvent((e: globalThis.PointerEvent) => {
    if (draggingRef.current === false) return

    const nextValue = getNextValue.current(e)

    onChange?.(nextValue, e)
  })

  const handleWindowPointerUp = useEvent((e: globalThis.PointerEvent) => {
    draggingRef.current = false

    onChangeComplete?.(value, e)

    window.removeEventListener('pointermove', handleWindowPointerMove)
    window.removeEventListener('pointerup', handleWindowPointerUp)
  })

  return (
    <Component
      ref={rootRef}
      className={className}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      role="widget"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      tabIndex={0}
      color={color}
      {...aria}
    >
      <div
        ref={cursorRef}
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 12,
          left: `${value * 100}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          userSelect: 'none',
        }}
      >
        <Cursor color={cursorColor} />
      </div>
    </Component>
  )
}, propsAreEquals)

function propsAreEquals(
  { color: prevColor, ...prev }: { color: ColorTypes.RGBA | ColorTypes.HSBA },
  { color: nextColor, ...next }: { color: ColorTypes.RGBA | ColorTypes.HSBA },
) {
  return shallowEquals(prev, next) && shallowEquals(prevColor, nextColor)
}

function toHSBA(color: ColorTypes.RGBA | ColorTypes.HSBA): ColorTypes.HSBA {
  return 'h' in color ? color : rgbaToHSBA(color)
}

export function rgbaToHSBA(rgba: ColorTypes.RGBA): ColorTypes.HSBA {
  const r = rgba.r / 255
  const g = rgba.g / 255
  const b = rgba.b / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h: number
  let s: number
  const v = max

  const diff = max - min
  s = max === 0 ? 0 : diff / max

  if (max === min) {
    h = 0 // achromatic
  } else {
    if (max === r) {
      h = (g - b) / diff + (g < b ? 6 : 0)
    } else if (max === g) {
      h = (b - r) / diff + 2
    } else if (max === b) {
      h = (r - g) / diff + 4
    } else {
      h = 0
    }

    h /= 6
  }

  return {
    h: h * 360,
    s: s,
    b: v,
    a: rgba.a,
  }
}

export function hsbaToRGBA(hsba: ColorTypes.HSBA): ColorTypes.RGBA {
  let r: number, g: number, b: number

  let h = hsba.h / 60
  let s = hsba.s
  let v = hsba.b

  let i = Math.floor(h)
  let f = h - i
  let p = v * (1 - s)
  let q = v * (1 - s * f)
  let t = v * (1 - s * (1 - f))

  switch (i) {
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
      r = 0
      g = 0
      b = 0
      break
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
    a: hsba.a,
  }
}
// FROM: https://stackoverflow.com/a/54116681
function hsvToHsl({ h, s, b, a }: ColorTypes.HSBA): {
  h: number
  s: number
  l: number
  a: number
} {
  const l = b - (b * s) / 2,
    m = Math.min(l, 1 - l)

  return { h, s: m ? (b - l) / m : 0, l, a: a ?? 1 }
}
