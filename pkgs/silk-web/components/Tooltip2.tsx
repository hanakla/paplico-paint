import { autoPlacement } from '@floating-ui/core'
import { arrow, autoUpdate, useFloating } from '@floating-ui/react-dom'
import { styleWhen } from '@hanakla/arma'
import { nanoid } from 'nanoid'
import { rgba } from 'polished'
import { ReactNode, useEffect, useMemo, useRef } from 'react'
import { createGlobalStyle } from 'styled-components'

type Props = {
  content: ReactNode
  children: ReactNode
  show?: boolean
}

export const Tooltip2 = ({ content, children, show }: Props) => {
  const id = useMemo(() => nanoid(), [])
  const arrowRef = useRef<HTMLDivElement | null>(null)

  const fl = useFloating({
    placement: 'top',
    strategy: 'fixed',
    middleware: [
      autoPlacement({ alignment: 'start', allowedPlacements: ['top'] }),
      arrow({ element: arrowRef }),
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
          position: fixed;
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
        {content}
        <div
          css={`
            position: absolute;
            width: 6px;
            height: 6px;
            transform: rotate(45deg);
            background-color: #111;
          `}
          ref={arrowRef}
          role="none"
          style={{
            left: fl.middlewareData.arrow?.x ?? 0,
            // top: fl.middlewareData.arrow?.y ?? 0,
            top: '100% !important',
          }}
        />
      </div>
      <Global id={id} show={show} />

      {children}
    </>
  )
}

const Global = createGlobalStyle<{ id: string; show?: boolean }>`
* > [data-tipid=${({ id }) => id}] {
  opacity: 0;
  pointer-events: none;
  transition: 0.2s ease-in-out;

  opacity: ${({ show }) => (show ? 1 : 0)};
}

*:hover > [data-tipid=${({ id }) => id}] {
  opacity: 1;
}
`
