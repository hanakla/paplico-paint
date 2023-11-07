import { ReactNode, memo } from 'react'
import * as _ScrollArea from '@radix-ui/react-scroll-area'
import { css } from 'styled-components'

type Props = {
  className?: string
  children?: ReactNode
}

export const ScrollArea = memo(function ScrollArea({
  className,
  children,
}: Props) {
  return (
    <_ScrollArea.Root
      css={css`
        display: flex;
        flex-flow: column;
        border-radius: 4px;
      `}
      className={className}
    >
      <_ScrollArea.Viewport
        css={css`
          display: flex;
          flex-flow: column;
          flex: 1;

          & > *:first-child {
            display: contents !important;
          }
        `}
      >
        {children}
      </_ScrollArea.Viewport>
      <_ScrollArea.Scrollbar orientation="vertical">
        <_ScrollArea.Thumb />
      </_ScrollArea.Scrollbar>
      <_ScrollArea.Scrollbar orientation="horizontal">
        <_ScrollArea.Thumb />
      </_ScrollArea.Scrollbar>
      <_ScrollArea.Corner />
    </_ScrollArea.Root>
  )
})

export const PplcScrollArea = memo(function PplcScrollArea({
  className,
  children,
}: {
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      css={css`
        overflow: auto;
      `}
      className={className}
    >
      {children}
    </div>
  )
})
