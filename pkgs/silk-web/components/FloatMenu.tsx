import { CSSProperties, forwardRef, ReactNode } from "react";

type Props = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export const FloatMenu = forwardRef<HTMLDivElement, Props>(({children, className, style}, ref) => {
  return (
    <div
      ref={ref}
      className={className}
      css={`
        margin-bottom: 16px;
        background-color: ${({theme}) => theme.surface.floatWhite};
        border-radius: 4px;

        &::before {
          content: '';
          display: inline-block;
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid;
          border-color: ${({theme}) => theme.surface.floatWhite} transparent transparent transparent;
        }
      `}
      style={style}
      // style={{
      //   ...brushPopper.styles.popper,
      //   ...(openBrush ? { opacity: 1, pointerEvents: 'all' } :  { opacity: 0, pointerEvents: 'none' })
      // }}
    >
      {children}
    </div>
  )
})
