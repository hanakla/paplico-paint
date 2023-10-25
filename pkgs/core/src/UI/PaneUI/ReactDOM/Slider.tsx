import { ChangeEvent, memo, useCallback } from 'react'
import { VComponent } from '../UI/PaneUI/AbstractComponent'

export namespace Slider {
  export type Props = {
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    step?: number
  }
}

export const Slider: VComponent<Slider.Props> = memo(function Slider({
  min,
  max,
  step,
  value,
  onChange,
}) {
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.valueAsNumber)
  }, [])

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={handleChange}
    />
  )
})
