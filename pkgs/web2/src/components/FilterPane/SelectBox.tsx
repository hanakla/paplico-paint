import { memo } from 'react'
import { PaneUI } from '@paplico/core-new'

export const SelectBox = memo(function SelectBox({
  placeholder,
  items,
  value,
  style,
}: PaneUI.PaneComponentProps.SelectBox) {
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
