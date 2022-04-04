import { rgba } from 'polished'
import { forwardRef, ReactNode } from 'react'

type Props = {
  className?: string
  children?: ReactNode
  // arrowRef?: Ref<HTMLDivElement>
}

export const Tooltip = forwardRef<HTMLDivElement, Props>(
  ({ children, className, arrowRef }, ref) => {
    return (
      <div
        ref={ref}
        css={`
          padding: 8px;
          background-color: ${rgba(0, 0, 0, 0.8)};
          border-radius: 8px;
          text-align: center;
          color: #fff;
        `}
        className={className}
        role="tooltip"
      >
        {children}
        <div ref={arrowRef} />
      </div>
    )
  }
)
