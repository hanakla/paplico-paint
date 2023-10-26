import { Text } from '@radix-ui/themes'
import { ComponentProps, ReactNode, memo } from 'react'
import { css } from 'styled-components'

type Props = {
  label: ReactNode
  labelTextSize?: ComponentProps<typeof Text>['size']
  htmlFor?: string
  valueField?: ReactNode
  children?: ReactNode
}

export const Fieldset = memo(function Fieldset({
  label,
  labelTextSize = { initial: '1' },
  htmlFor,
  valueField,
  children,
}: Props) {
  return (
    <fieldset
      css={css`
        & + & {
          margin-top: 2px;
        }
      `}
    >
      <div
        css={css`
          display: flex;
          align-items: center;
          margin-bottom: 2px;
        `}
      >
        <label htmlFor={htmlFor}>
          <Text
            css={css`
              display: flow-root;
            `}
            size={labelTextSize}
            weight="medium"
          >
            {label}
          </Text>
        </label>
        {valueField && (
          <div
            css={css`
              margin-left: auto;
            `}
          >
            <Text size={labelTextSize}>{valueField}</Text>
          </div>
        )}
      </div>

      {children}
    </fieldset>
  )
})
