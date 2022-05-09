import {
  StyledIconBase,
  StyledIcon,
  StyledIconProps,
} from '@styled-icons/styled-icon'
import { forwardRef } from 'react'

export const DragDots: StyledIcon = forwardRef<SVGSVGElement, StyledIconProps>(
  (props, ref) => {
    const attrs: React.SVGProps<SVGSVGElement> = {
      fill: 'currentColor',
      // 'fill-opacity',
      // 'fill-rule',
      // 'stroke',
      // 'stroke-dasharray',
      // 'stroke-dashoffset',
      // 'stroke-linecap',
      // 'stroke-linejoin',
      // 'stroke-miterlimit',
      // 'stroke-opacity',
    }

    return (
      <StyledIconBase
        iconAttrs={attrs}
        iconVerticalAlign="middle"
        iconViewBox="0 0 24 24"
        {...props}
        ref={ref}
      >
        <g>
          <circle cx="8.69" cy="5.61" r="1.5" />
          <circle cx="8.69" cy="12" r="1.5" />
          <circle cx="8.69" cy="18.39" r="1.5" />
        </g>
        <g>
          <circle cx="15.31" cy="5.61" r="1.5" />
          <circle cx="15.31" cy="12" r="1.5" />
          <circle cx="15.31" cy="18.39" r="1.5" />
        </g>
      </StyledIconBase>
    )
  }
)

DragDots.displayName = '{{name}}'

// export const {{name}}Dimensions = {height: {{height}}, width: {{width}}}
