import { useFunk } from '@hanakla/arma'
import { nanoid } from 'nanoid'
import { rgba } from 'polished'
import {
  useContext,
  useState,
  useMemo,
  useRef,
  Ref,
  createContext,
  ReactNode,
  useEffect,
  MouseEvent,
} from 'react'
import {
  animation,
  ContextMenuParams,
  HandlerParamsEvent,
  Item,
  ItemParams,
  Menu,
  useContextMenu as originalUseContextMenu,
} from 'react-contexify'
import { useClickAway, useToggle } from 'react-use'
import { css } from 'styled-components'
import { isEventIgnoringTarget } from '🙌/features/Paint/helpers'
import { Portal } from './Portal'

export type ContextMenuParam<T> = ItemParams<T, any>

// const ContextMenuContext = createContext<{
//   opened: boolean
//   position: { x: number; y: number }
//   close: () => void
// } | null>(null)

export const useContextMenu = (menuId: string) => {
  const id = useMemo(() => menuId ?? nanoid(), [])
  const menu = originalUseContextMenu({ id: id })

  return { id, show: menu.show.bind(menu), hideAll: menu.hideAll.bind(menu) }
}

/** @deprecated */
export const ContextMenuArea = ({ children }: { children: ReactNode }) => {
  const [opened, toggle] = useToggle(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const handlerRef = useRef<HTMLElement | null>(null)

  const contextMenuController = useMemo(
    () => ({
      opened,
      position,
      close: () => opened && toggle(false),
    }),
    [opened, position, toggle]
  )

  useEffect(() => {
    const handler = (e: globalThis.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      setPosition({ x: e.pageX, y: e.pageY })
      toggle(true)
    }

    handlerRef.current?.addEventListener('contextmenu', handler)
    return () => handlerRef.current?.removeEventListener('contextmenu', handler)
  }, [])

  return (
    // <ContextMenuContext.Provider value={contextMenuController}>
    children
    // {/* </ContextMenuContext.Provider> */}
  )
}

export const ContextMenu: React.FC<{ id: string }> = ({ id, children }) => {
  // const { opened, position, close } = useContext(ContextMenuContext)!
  // const rootRef = useRef<HTMLDivElement | null>(null)

  return (
    <Menu id={id} animation={false}>
      {children}
    </Menu>
  )

  // return (
  //   // <Portal>
  //   <div
  //     ref={rootRef}
  //     css={css`
  //       position: fixed;
  //       z-index: 100;
  //       padding: 4px 4px;
  //       margin-top: -8px;
  //       margin-left: 2px;
  //       background-color: ${({ theme }) => theme.exactColors.whiteFade70};
  //       border-radius: 4px;
  //       box-shadow: ${({ theme }) =>
  //         `0 0 5px 1px ${theme.exactColors.blackFade10}`};
  //       font-size: 12px;
  //       backdrop-filter: blur(8px);
  //     `}
  //     style={{
  //       top: position.y,
  //       left: position.x,
  //       ...(opened
  //         ? { visibility: 'visible', pointerEvents: 'all' }
  //         : { visibility: 'hidden', pointerEvents: 'none' }),
  //     }}
  //   >
  //     {children}
  //   </div>
  //   // </Portal>
  // )
}

// export type ContextMenuCallback = (e: MouseEvent, data: any) => void

export const ContextMenuItem = ({
  data,
  children,
  onClick,
  ...props
}: {
  data?: any
  children?: ReactNode
  onClick: (e: ContextMenuParam<any>) => void
}) => {
  return (
    <Item onClick={onClick} data={data} {...props}>
      {children}
    </Item>

    // <div
    //   css={css`
    //     min-width: 100px;
    //     padding: 2px 12px;
    //     border-radius: 2px;
    //     text-align: left;
    //     color: ${({ theme }) => theme.text.mainActionsBlack};

    //     &:hover {
    //       color: ${({ theme }) => theme.text.contextMenuActive};
    //       background-color: ${({ theme }) => theme.surface.contextMenuActive};
    //     }
    //   `}
    //   onClick={handleClick}
    // >
    //   {children}
    // </div>
  )
}
