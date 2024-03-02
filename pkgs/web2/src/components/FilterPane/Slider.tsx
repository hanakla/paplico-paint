import { PaneUI } from '@paplico/core-new'
import { Slider as _Slider } from '@radix-ui/themes'

import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { css } from 'styled-components'

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
      css={css`
        height: 18px;
      `}
      min={min}
      max={max}
      step={step}
      value={[value]}
      style={style}
      onValueChange={handleOnChange}
    />
  )
})
