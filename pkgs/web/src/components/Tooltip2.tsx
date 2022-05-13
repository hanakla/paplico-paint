import { autoPlacement } from '@floating-ui/core'
import {
  arrow,
  autoUpdate,
  useFloating,
  Placement,
  Strategy,
} from '@floating-ui/react-dom'
import { nanoid } from 'nanoid'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useMount, useMountedState } from 'react-use'
import { createGlobalStyle, css } from 'styled-components'
import { useAutoUpdateFloating } from '../utils/hooks'
import { Portal } from './Portal'

type Props = {
  children: ReactNode
  show?: boolean
  hoverToShow?: boolean
  placement?: Placement
  strategy?: Strategy
  usePortal?: boolean
}

export const Tooltip2 = ({
  children,
  show,
  hoverToShow = true,
  placement = 'top',
  strategy = 'fixed',
  usePortal,
}: Props) => {
  const id = useMemo(() => nanoid().replace(/-/gm, ''), [])
  const inspectRef = useRef<HTMLElement | null>(null)
  const arrowRef = useRef<HTMLDivElement | null>(null)
  const isMounted = useMountedState()
  const [parentHover, setParentHover] = useState(false)

  const fl = useFloating({
    placement,
    strategy,
    middleware: [
      autoPlacement({
        alignment: 'start',
        allowedPlacements: ['top'],
        padding: 2,
      }),
      arrow({ element: arrowRef, padding: 2 }),
    ],
  })

  useEffect(() => {
    if (!inspectRef.current?.parentElement) return

    const parent = inspectRef.current.parentElement

    const onHover = () => setParentHover(true)
    const onLeaver = () => setParentHover(false)

    parent.addEventListener('mouseover', onHover, { passive: true })
    parent.addEventListener('mouseleave', onLeaver, { passive: true })

    fl.reference(parent)
    fl.update()

    return () => {
      parent.removeEventListener('mouseover', onHover)
      parent.removeEventListener('mouseleave', onLeaver)
    }
  }, [fl.refs.floating, isMounted])

  useAutoUpdateFloating(fl)

  const tooltip = (
    <>
      <div
        css={`
          /* z-index: 1; */
          padding: 4px;
          background-color: #111;
          border-radius: 4px;
          text-align: center;
          font-size: 10px;
          color: #fff;
        `}
        ref={fl.floating}
        role="tooltip"
        data-tipid={id}
        style={{
          position: fl.strategy,
          left: fl.x ?? 0,
          top: fl.y ?? 0,
        }}
      >
        <div
          css={`
            position: absolute;
            z-index: 0;
            width: 8px;
            height: 8px;
            transform: rotate(45deg);
            /* background-color: #111; */
            border: 4px solid transparent;
          `}
          ref={arrowRef}
          role="none"
          style={{
            left: fl.middlewareData.arrow?.x ?? 0,
            top: fl.middlewareData.arrow?.y ?? 0,
            borderColor:
              // prettier-ignore
              /top/.test(placement) ? 'transparent transparent #111 transparent'
              : /right/.test(placement) ? 'transparent #111 transparent transparent'
              : /bottom/.test(placement) ? '#111 transparent transparent transparent'
              : /left/.test(placement) ? 'transparent transparent transparent #111'
              : undefined,
          }}
        />

        <span
          css={`
            position: relative;
          `}
        >
          {children}
        </span>
      </div>
      <Global id={id} show={show || parentHover} hoverToShow={hoverToShow} />
    </>
  )

  return (
    <>
      <span
        ref={inspectRef}
        css={`
          display: none;
        `}
      />
      {usePortal ? <Portal displayName="Tooltip2">{tooltip}</Portal> : tooltip}
    </>
  )
}

const Global = createGlobalStyle<{
  id: string
  show?: boolean
  hoverToShow: boolean
}>`
* > [data-tipid="${({ id }) => id}"] {
  opacity: 0;
  pointer-events: none;
  transition: 0.2s ease-in-out;

  opacity: ${({ show }) => (show ? 1 : 0)};
}

  ${({ hoverToShow, id }) =>
    hoverToShow &&
    css`
      *:hover > [data-tipid='${id}'] {
        opacity: 1;
      }
    `}
`
