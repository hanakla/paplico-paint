import { autoPlacement } from '@floating-ui/core'
import {
  arrow,
  autoUpdate,
  useFloating,
  Placement,
  Strategy,
} from '@floating-ui/react-dom'
import { nanoid } from 'nanoid'
import { ReactNode, useEffect, useMemo, useRef } from 'react'
import { createGlobalStyle, css } from 'styled-components'

type Props = {
  content: ReactNode
  children?: ReactNode
  show?: boolean
  hoverToShow?: boolean
  placement?: Placement
  strategy?: Strategy
}

export const Tooltip2 = ({
  content,
  children,
  show,
  hoverToShow = true,
  placement = 'top',
  strategy = 'fixed',
}: Props) => {
  const id = useMemo(() => nanoid().replace(/-/gm, ''), [])
  const arrowRef = useRef<HTMLDivElement | null>(null)

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
    fl.reference(fl.refs.floating.current!.parentElement)
    if (!fl.refs.reference.current! || !fl.refs.floating.current!) return

    autoUpdate(
      fl.refs.reference.current!,
      fl.refs.floating.current!,
      fl.update!
    )
  }, [fl.refs.reference.current, fl.refs.floating.current])

  return (
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
          {content}
        </span>
      </div>
      <Global id={id} show={show} hoverToShow={hoverToShow} />

      {children}
    </>
  )
}

const Global = createGlobalStyle<{
  id: string
  show: boolean
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
