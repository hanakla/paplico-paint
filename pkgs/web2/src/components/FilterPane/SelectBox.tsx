import { ChangeEvent, memo } from 'react'
import { PaneUI } from '@paplico/core-new'
import useEvent from 'react-use-event-hook'

export const SelectBox = memo(function SelectBox({
  placeholder,
  items,
  value,
  style,
  onChange,
}: PaneUI.PaneComponentProps.SelectBox) {
  const handleChange = useEvent((event: ChangeEvent<HTMLSelectElement>) => {
    onChange(event.currentTarget.value)
  })

  return (
    <select
      value={value}
      placeholder={placeholder}
      style={style}
      onChange={handleChange}
    >
      {items.map(({ label, value }) => (
        <option key={value} value={value}>
          {label ?? value}
        </option>
      ))}
    </select>
  )
})
