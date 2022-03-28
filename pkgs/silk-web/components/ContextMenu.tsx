import {
  useContext,
  useCallback,
  useState,
  useMemo,
  useRef,
  Ref,
  createContext,
  ReactNode,
  useEffect,
  MouseEvent,
} from 'react'
import { useClickAway, useToggle } from 'react-use'
import { css } from 'styled-components'
import { Portal } from './Portal'

const ContextMenuContext = createContext<{
  opened: boolean
  position: { x: number; y: number }
  close: () => void
} | null>(null)

export const useContextMenu = () => {
  useEffect(() => {})

  return null
}

export const ContextMenuArea = ({
  children,
}: {
  children: (ref: Ref<HTMLElement | null>) => ReactNode
}) => {
  const [opened, toggle] = useToggle(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const handlerRef = useRef<HTMLElement | null>(null)

  const contextMenuController = useMemo(
    () => ({
      opened,
      position,
      close: () => toggle(false),
    }),
    [opened, position, toggle]
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      setPosition({ x: e.pageX, y: e.pageY })
      toggle(true)
    }

    handlerRef.current?.addEventListener('contextmenu', handler)
    return () => handlerRef.current?.removeEventListener('contextmenu', handler)
  }, [])

  return (
    <ContextMenuContext.Provider value={contextMenuController}>
      {children(handlerRef)}
    </ContextMenuContext.Provider>
  )
}

export const ContextMenu: React.FC = ({ children }) => {
  const { opened, position, close } = useContext(ContextMenuContext)!
  const rootRef = useRef<HTMLDivElement | null>(null)

  useClickAway(rootRef, () => {
    close()
  })

  useEffect(() => {}, [])

  return (
    // <Portal>
    <div
      ref={rootRef}
      css={css`
        position: fixed;
        z-index: 100;
        padding: 4px 4px;
        margin-top: -8px;
        margin-left: 2px;
        background-color: ${({ theme }) => theme.exactColors.whiteFade40};
        border-radius: 4px;
        box-shadow: ${({ theme }) =>
          `0 0 5px 1px ${theme.exactColors.black50}`};
        font-size: 13px;
        backdrop-filter: blur(4px);
      `}
      style={{
        top: position.y,
        left: position.x,
        ...(opened
          ? { visibility: 'visible', pointerEvents: 'all' }
          : { visibility: 'hidden', pointerEvents: 'none' }),
      }}
    >
      {children}
    </div>
    // </Portal>
  )
}

export type ContextMenuCallback = (e: MouseEvent, data: any) => void

export const ContextMenuItem = ({
  data,
  children,
  onClick,
}: {
  data?: any
  children?: ReactNode
  onClick: ContextMenuCallback
}) => {
  const { close } = useContext(ContextMenuContext)!

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      onClick?.(e, data)
      close()
    },
    [data]
  )

  return (
    <div
      css={css`
        min-width: 100px;
        padding: 2px 12px;
        border-radius: 2px;
        text-align: left;
        color: ${({ theme }) => theme.text.mainActionsBlack};

        &:hover {
          color: ${({ theme }) => theme.text.contextMenuActive};
          background-color: ${({ theme }) => theme.surface.contextMenuActive};
        }
      `}
      onClick={handleClick}
    >
      {children}
    </div>
  )
}
