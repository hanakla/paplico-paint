import { ReactNode } from 'react'

type Props = {
  gap?: 4 | 8 | 12 | 16
  dir: 'vertical' | 'horizontal'
  className?: string
  children?: ReactNode
}

export const Stack = ({
  gap = 8,
  dir = 'vertical',
  className,
  children,
}: Props) => (
  <div
    css={`
      display: flex;
      flex-flow: ${dir === 'vertical' ? 'column' : 'row'};
      gap: ${gap}px;
    `}
    className={className}
  >
    {children}
  </div>
)
