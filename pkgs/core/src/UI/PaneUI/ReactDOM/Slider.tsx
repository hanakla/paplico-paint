import { ChangeEvent, memo, useCallback } from 'react'
import { PaneComponentProps } from '../PaneComponentProps'
import { VComponent } from '../AbstractComponent'

export const Slider: VComponent<PaneComponentProps.Slider> = memo(
  function Slider({ min, max, step, value, onChange }) {
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
  },
)
