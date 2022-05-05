import { ReactNode } from 'react'
import { media } from '../utils/responsive'

type Props = {
  gap?: 4 | 8 | 12 | 16
  dir: 'vertical' | 'horizontal'
  narrowDir?: 'vertical' | 'horizontal'
  justify?: 'start' | 'end'
  className?: string
  children?: ReactNode
}

export const Stack = ({
  gap = 8,
  dir = 'vertical',
  narrowDir,
  justify = 'start',
  className,
  children,
}: Props) => (
  <div
    css={`
      display: flex;
      flex-flow: ${dir === 'vertical' ? 'column' : 'row'};
      justify-content: ${justify === 'start' ? 'flex-start' : 'flex-end'};
      gap: ${gap}px;

      ${narrowDir &&
      media.narrow`
        flex-flow: ${narrowDir === 'vertical' ? 'column' : 'row'};
      `}
    `}
    className={className}
  >
    {children}
  </div>
)
