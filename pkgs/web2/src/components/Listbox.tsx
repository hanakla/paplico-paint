import {
  memo,
  isValidElement,
  useState,
  useCallback,
  MouseEvent,
  ReactNode,
  cloneElement,
  Children,
  ComponentProps,
  createContext,
} from 'react'
import useEvent from 'react-use-event-hook'
import { css } from 'styled-components'

type Props = {
  // items: string[]
  value: string[]
  onChange?: (selectedItems: string[]) => void
  multiple?: boolean
  className?: string
  children: ReactNode
}

export const Listbox = memo(function Listbox({
  value,
  multiple = false,
  className,
  onChange,
  children,
}: Props) {
  // const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [selectedItems, setSelectedItems] = useState<string[]>(value)
  const [lastShiftClickIndex, setLastShiftClickIndex] = useState<number | null>(
    null,
  )

  const items =
    Children.map(children, (child, idx) => {
      if (isValidElement<ComponentProps<typeof ListboxItem>>(child)) {
        return child.props.value
      }
    })?.filter((item): item is string => typeof item === 'string') ?? []

  // const handleKeyDown = useEvent((e: KeyboardEvent<HTMLUListElement>) => {
  //   if (multiple) return

  //   switch (e.key) {
  //     case 'ArrowDown':
  //       setSelectedIndices((prev) => {
  //         return Math.min(prev + 1, items.length - 1)
  //       })
  //       break
  //     case 'ArrowUp':
  //       setSelectedIndices((prev) =>
  //         prev !== null ? Math.max(prev - 1, 0) : 0,
  //       )
  //       break
  //     case 'Enter':
  //       if (selectedIndices !== null) {
  //         onChange?.([items[selectedIndices]])
  //       }
  //       break
  //   }
  //   // Note: For multiple selection with keyboard, additional logic is needed.
  // })

  const handleClick = useEvent<ComponentProps<typeof ListboxItem>['onClick']>(
    (event, value) => {
      if (!multiple) {
        setSelectedItems([value])
        // setSelectedIndices(index)
        onChange?.([value])
        return
      }

      const index = items.indexOf(value)
      if (index === -1) return

      let newSelectedItems: string[]
      if (event.shiftKey) {
        if (lastShiftClickIndex == null) {
          setSelectedItems([value])
          setLastShiftClickIndex(index)
        } else {
          const startIndex = Math.min(lastShiftClickIndex, index)
          const endIndex = Math.max(lastShiftClickIndex, index)

          const newSelectedItems = [...selectedItems]

          for (let i = startIndex; i <= endIndex; i++) {
            if (!newSelectedItems.includes(value)) {
              newSelectedItems.push(value)
            }
          }

          setSelectedItems((prev) => [...prev, value])
          onChange?.(newSelectedItems)
        }
      } else if (event.metaKey || event.ctrlKey) {
        if (selectedItems.includes(value)) {
          setSelectedItems((prev) => {
            return prev.filter((item) => item !== value)
          })
        } else {
          setSelectedItems((prev) => [...prev, value])
        }

        setLastShiftClickIndex(index)
        onChange?.(newSelectedItems)
      } else {
        setSelectedItems([value])
        onChange?.([value])
      }

      setLastShiftClickIndex(index)
    },
  )

  return (
    <ul
      css={css`
        display: block;
        width: 100%;
      `}
      className={className}
      // onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {Children.map(children, (child, idx) => {
        if (isValidElement<ComponentProps<typeof ListboxItem>>(child)) {
          return cloneElement<ComponentProps<typeof ListboxItem>>(child, {
            selected: selectedItems.includes(child.props.value),
            // index: idx,
            onClick: handleClick,
          })
        }

        return child
      })}
    </ul>
  )
})

export const ListboxItem = memo(function ListboxItem({
  value,
  // index,
  selected,
  onClick,
  children,
  className,
}: {
  value: string
  // index: number
  selected?: boolean
  className?: string
  onClick?: (e: MouseEvent<HTMLLIElement>, value: string) => void
  children?: React.ReactNode
}) {
  const handleClick = useCallback(
    (e: MouseEvent<HTMLLIElement>) => {
      onClick?.(e, value)
    },
    [value],
  )

  console.log()

  return (
    <li
      css={css`
        display: flex;
        align-content: center;
        padding: 8px 16px;
      `}
      style={{
        backgroundColor: selected ? '#ddd' : 'transparent',
      }}
      className={className}
      onClick={handleClick}
    >
      {children}
    </li>
  )
})
