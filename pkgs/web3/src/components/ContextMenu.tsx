import { memo, useId, useMemo } from 'react'
import { css } from 'styled-components'
import {
  Item as _Item,
  ItemParams,
  ItemProps,
  Menu as _Menu,
  Separator,
  useContextMenu as originalUseContextMenu,
  MenuProps,
  ShowContextMenuParams as _ShowContextMenuParams,
} from 'react-contexify'
import { Portal } from './Portal'
import 'react-contexify/ReactContexify.css'

export type ContextMenuParam<T> = ItemParams<T, any>
export type ContextMenuItemClickHandler<T> = (
  params: ContextMenuParam<T>,
) => void

export type ShowContextMenuParams<T> = Omit<_ShowContextMenuParams<T>, 'id'>

export const useContextMenu = <T extends object>() => {
  const id = useId()
  const menu = originalUseContextMenu({ id: id })

  return useMemo(
    () => ({
      id,
      show: (params: Omit<ShowContextMenuParams<T>, 'id'>) => menu.show(params),
      hideAll: menu.hideAll.bind(menu),
    }),
    [],
  )
}

const Menu = memo<MenuProps>(function ContextMenuRoot(props) {
  return (
    <Portal>
      <_Menu
        css={css`
          position: fixed;
          min-width: 150px;
          padding: 4px;
          background: rgba(248, 248, 248, 0.9) !important;
          border-radius: 8px;
          font-size: var(--font-size-2);
          z-index: 1;
          backdrop-filter: blur(8px);
          box-shadow: 1px 2px 12px rgba(0, 0, 0, 0.2);
        `}
        {...props}
        disableBoundariesCheck
        animation={false}
      />
    </Portal>
  )
})

const Item = memo<ItemProps>(function ContextMenuItm({
  data,
  children,
  onClick,
  ...props
}) {
  return (
    <_Item
      css={`
        .contexify_itemContent {
          padding: 4px;
          background-color: none !important;

          &:hover {
            background-color: var(--accent-8) !important;
          }
        }
      `}
      onClick={(e) => {
        console.log('hi')
        onClick?.(e)
      }}
      data={data}
      {...props}
    >
      {children}
    </_Item>
  )
})

export const ContextMenu = { Menu, Item, Separator }
