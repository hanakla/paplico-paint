import { useCallback, ChangeEvent, useEffect, MouseEvent, useMemo } from 'react'
import { rgba } from 'polished'
import { rangeThumb } from '../utils/mixins'
import { SpringValue, useSpring } from 'react-spring'
import { useRef } from 'react'

export const DeltaRange = ({
  value,
  step = 1,
  max = Infinity,
  min = -Infinity,
  className,
  onChange,
  onChangeComplete,
}: {
  value: number
  step?: number
  max?: number
  min?: number
  className?: string
  onChange: (value: number) => void
  onChangeComplete?: () => void
}) => {
  const INPUT_MAX = 200

  const baseValue = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputValue = useMemo(
    () => new SpringValue(INPUT_MAX / 2, { config: { duration: 100 } }),
    []
  )

  const handleChange = useCallback(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (baseValue.current == null) {
        baseValue.current = value
      }

      const delta = currentTarget.valueAsNumber - 50
      onChange(Math.min(max, Math.max(baseValue.current + delta * step, min)))
    },
    [value, max, min, step]
  )

  const handleMouseDown = useCallback(() => {
    if (baseValue.current == null) {
      baseValue.current = value
    }
  }, [value])

  const handleMouseUp = useCallback(
    ({ currentTarget }: MouseEvent<HTMLInputElement>) => {
      const base = baseValue.current!
      const current = currentTarget.valueAsNumber
      const delta = current - 50

      inputValue.start({ from: current, to: INPUT_MAX / 2 })
      baseValue.current = null

      onChange(Math.min(max, Math.max(base + delta * step, min)))
      onChangeComplete?.()
    },
    [value, max, min, step]
  )

  useEffect(
    () => {
      inputValue.animation.onChange = (value) => {
        inputRef.current!.valueAsNumber = value as unknown as number
      }

      return () => {
        inputValue.animation.onChange = undefined
      }
    } /*, [] なぜかレンダリング毎にonChangeを設定しないと死ぬ*/
  )

  return (
    <input
      ref={inputRef}
      css={`
        ${rangeThumb}

        background: linear-gradient(
            90deg,
            ${rgba('#fff', 0)} 0%,
            ${rgba('#fff', 1)} 10%,
            ${rgba('#fff', 1)} 90%,
            ${rgba('#fff', 0)} 100%
          );
      `}
      type="range"
      min={0}
      max={INPUT_MAX}
      step={1}
      // value={inputValue.get()}
      defaultValue={inputValue.get()}
      className={className}
      onChange={handleChange}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    />
  )
}
