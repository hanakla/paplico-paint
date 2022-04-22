import { nanoid } from 'nanoid'
import { useState, useMemo, useRef, ReactNode, useEffect } from 'react'
import {
  Item,
  ItemParams,
  ItemProps,
  Menu,
  Separator,
  useContextMenu as originalUseContextMenu,
} from 'react-contexify'
import { useToggle } from 'react-use'

export type ContextMenuParam<T> = ItemParams<T, any>

// const ContextMenuContext = createContext<{
//   opened: boolean
//   position: { x: number; y: number }
//   close: () => void
// } | null>(null)

export const useContextMenu = () => {
  const id = useMemo(() => nanoid(), [])
  const menu = originalUseContextMenu({ id: id })

  return { id, show: menu.show.bind(menu), hideAll: menu.hideAll.bind(menu) }
}

export { Separator }

export const ContextMenu: React.FC<{ id: string }> = ({ id, children }) => {
  // const { opened, position, close } = useContext(ContextMenuContext)!
  // const rootRef = useRef<HTMLDivElement | null>(null)

  return (
    <Menu
      css={`
        min-width: auto;
        padding: 6px 4px;
      `}
      id={id}
      animation={false}
    >
      {children}
    </Menu>
  )
}

// export type ContextMenuCallback = (e: MouseEvent, data: any) => void

export const ContextMenuItem = ({
  data,
  children,
  onClick,
  ...props
}: ItemProps) => {
  return (
    <Item
      css={`
        .react-contexify__item__content {
          padding: 4px 8px;
        }
      `}
      onClick={onClick}
      data={data}
      {...props}
    >
      {children}
    </Item>
  )
}
