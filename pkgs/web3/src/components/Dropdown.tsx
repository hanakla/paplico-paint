import { ReactNode, memo } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

type Props = {
  trigger: ReactNode
  children: ReactNode
}

export const Dropdown = memo(function Dropdown({ trigger, children }: Props) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          {children}
          <DropdownMenu.Arrow />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
})
