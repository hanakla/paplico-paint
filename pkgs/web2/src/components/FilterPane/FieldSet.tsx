import { PaneUI } from '@paplico/core-new'
import { memo, useId } from 'react'
import { css } from 'styled-components'

export const FieldSet = memo(function FieldSet({
  title,
  postTitle,
  displayValue,
  input: inputs,
  style,
}: PaneUI.PaneComponentProps.FieldSet) {
  const id = useId()

  return (
    <fieldset
      css={css`
        display: flex;
        padding: 2px 0;
      `}
      style={{ display: 'flex', flexFlow: 'column', ...style }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          margin: '4px 0 0 2px',
        }}
      >
        <div
          css={css`
            font-size: var(--font-size-2);
          `}
        >
          <label htmlFor={id}>{title}</label>
          {postTitle}
        </div>

        {displayValue != null && (
          <div
            style={{
              marginLeft: 'auto',
              fontSize: 'var(--font-size-2)',
            }}
            role="status"
            aria-live="polite"
            aria-label={`Current ${title} value`}
          >
            {displayValue}
          </div>
        )}
      </div>

      {inputs}
    </fieldset>
  )
})
