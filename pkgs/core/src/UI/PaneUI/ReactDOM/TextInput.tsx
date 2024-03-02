import { ChangeEvent, memo, useCallback } from 'react'
import { VComponent } from '../AbstractComponent'

export namespace TextInput {
  export type Props = {
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
