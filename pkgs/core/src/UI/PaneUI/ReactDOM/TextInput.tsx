import { VComponent } from '../AbstractComponent'
import { ChangeEvent, memo, useCallback } from 'react'

export namespace TextInput {
  export interface Props {
    value: string
    onChange: (value: string) => void
  }
}

export const TextInput: VComponent<TextInput.Props> = memo(function TextInput({
  value,
  onChange,
}: TextInput.Props) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value)
    },
    [onChange],
  )

  return <input type="text" value={value} onChange={handleChange} />
})
