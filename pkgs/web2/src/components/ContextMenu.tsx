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
import { Requires } from '@/utils/types'

export type ContextMenuParam<T> = ItemParams<T, any>
export type ContextMenuItemClickHandler<T> = (
  params: Requires<ContextMenuParam<T>, 'props'>,
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
    <_Menu
      css={css`
        min-width: auto;
        padding: 6px 4px;
      `}
      {...props}
      animation={false}
    />
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
        .react-contexify__item__content {
          padding: 4px 8px;
        }
      `}
      onClick={onClick}
      data={data}
      {...props}
    >
      {children}
    </_Item>
  )
})

export const ContextMenu = { Menu, Item, Separator }
