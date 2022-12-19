import {
  StyledIconBase,
  StyledIcon,
  StyledIconProps,
} from '@styled-icons/styled-icon'
import { forwardRef, memo } from 'react'

export const ObjectAlignLeft: StyledIcon = memo(
  forwardRef<SVGSVGElement, StyledIconProps>((props, ref) => {
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
        <path d="M6,13.5h14.59v4H6v-4Zm0-7.1h10.59v4H6V6.4Z" />
        <rect x="3" y="3.5" width="1" height="17" />
      </StyledIconBase>
    )
  })
)

ObjectAlignLeft.displayName = 'ObjectAlignLeft'

// export const {{name}}Dimensions = {height: {{height}}, width: {{width}}}
