import { PaneComponentProps } from '../PaneComponentProps'
import { memo } from 'react'

export const SelectBox = memo(function SelectBox({
  placeholder,
  items,
  value,
  style,
}: PaneComponentProps.SelectBox) {
  return (
    <select value={value} placeholder={placeholder} style={style}>
      {items.map(({ label, value }) => (
        <option key={value} value={value}>
          {label ?? value}
        </option>
      ))}
    </select>
  )
})
