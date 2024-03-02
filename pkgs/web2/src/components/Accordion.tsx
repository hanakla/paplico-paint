import * as Accordion from '@radix-ui/react-accordion'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { ReactNode, forwardRef, memo } from 'react'
import styled, { css, keyframes } from 'styled-components'

export const AccordionRoot = Accordion.Root
export const AccordionItem = Accordion.Item

export const AccordionTrigger = memo(
  forwardRef<HTMLButtonElement, { className?: string; children?: ReactNode }>(
    ({ className, children }, ref) => {
      return (
        <Accordion.Trigger
          ref={ref}
          css={css`
            appearance: none;
            border: none;
            background: none;
            display: flex;
            align-content: center;
            width: 100%;
            padding: 4px 8px;
            user-select: none;
          `}
          className={className}
        >
          <ChevronDownIcon
            css={css`
              margin-right: 4px;
              color: var(--violet-10);
              transition: transform 300ms cubic-bezier(0.87, 0, 0.13, 1);

              &:where([data-state='open'] > *) {
                transform: rotate(180deg);
              }
            `}
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
        css={css`
          margin-bottom: 8px;
          padding: 4px 8px;
          overflow: hidden;

          &[data-state='open'] {
            animation: ${slideDown} 100ms ease-out;
          }
          &[data-state='closed'] {
            animation: ${slideUp} 100ms ease-out;
          }
        `}
        className={className}
      >
        {children}
      </Accordion.Content>
    )
  },
)

const slideDown = keyframes`
  from {
    height: 0;
  }
  to {
    height: var(--radix-accordion-content-height);
  }
`

const slideUp = keyframes`
  from {
    height: var(--radix-accordion-content-height);
  }
  to {
    height: 0;
  }
`
