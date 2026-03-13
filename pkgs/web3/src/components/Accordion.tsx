import { twx } from '@/utils/tailwind'
import * as Accordion from '@radix-ui/react-accordion'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { ReactNode, forwardRef, memo } from 'react'

export const AccordionRoot = Accordion.Root
export const AccordionItem = Accordion.Item

export const AccordionTrigger = memo(
  forwardRef<HTMLButtonElement, { className?: string; children?: ReactNode }>(
    ({ className, children }, ref) => {
      return (
        <Accordion.Trigger
          ref={ref}
          className={twx(
            'appearance-none border-none bg-transparent flex items-center w-full py-1 px-2 select-none',
            className,
          )}
        >
          <ChevronDownIcon
            className="mr-1 text-[var(--violet-10)] transition-transform duration-300 ease-[cubic-bezier(0.87,0,0.13,1)] data-[state=open]:rotate-180"
            aria-hidden
          />
          {children}
        </Accordion.Trigger>
      )
    },
  ),
)

export const AccordionContent = memo(
  ({ className, children }: { className?: string; children?: ReactNode }) => {
    return (
      <Accordion.Content
        className={`mb-2 py-1 px-2 overflow-hidden data-[state=open]:animate-accordionSlideDown data-[state=closed]:animate-accordionSlideUp ${
          className || ''
        }`}
      >
        {children}
      </Accordion.Content>
    )
  },
)
