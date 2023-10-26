import { TextField } from '@/components/TextField'
import { PaneUI } from '@paplico/core-new'

import { ChangeEvent, memo } from 'react'
import useEvent from 'react-use-event-hook'

export const TextInput = memo(function TextInput({
  value,
  style,
  onChange,
}: PaneUI.PaneComponentProps.TextInput) {
  const handleOnChange = useEvent((e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.value)
  })

  return (
    <TextField size="1" style={style} onChange={handleOnChange} value={value} />
  )
})
