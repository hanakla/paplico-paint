import { DropdownMenu as _DropdownMenu } from '@radix-ui/themes'
import { ReactNode, memo } from 'react'
import { css } from 'styled-components'

type Props = {
  trigger: ReactNode
  children?: ReactNode
}

export const DropdownMenu = memo(function DropdownMenu({
  trigger,
  children,
}: Props) {
  return (
    <_DropdownMenu.Root>
      <_DropdownMenu.Trigger>{trigger}</_DropdownMenu.Trigger>
      <_DropdownMenu.Content
        css={css`
          z-index: 2;
        `}
        asChild
        size="2"
      >
        {children}
      </_DropdownMenu.Content>
    </_DropdownMenu.Root>
  )
})

export const DropdownMenuItem = _DropdownMenu.Item
export const DropdownMenuSeparator = _DropdownMenu.Separator
