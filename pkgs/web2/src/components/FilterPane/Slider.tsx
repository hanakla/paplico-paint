import { PaneUI } from '@paplico/core-new'
import { Slider as _Slider } from '@radix-ui/themes'

import { memo } from 'react'
import useEvent from 'react-use-event-hook'

export const Slider = memo(function Slider({
  style,
  min,
  max,
  step,
  value,
  onChange,
}: PaneUI.PaneComponentProps.Slider) {
  const handleOnChange = useEvent(([value]: number[]) => {
    onChange(value)
  })

  return (
    <_Slider
      min={min}
      max={max}
      step={step}
      value={[value]}
      style={style}
      onValueChange={handleOnChange}
    />
  )
})
