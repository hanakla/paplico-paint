import { memo, useId } from 'react'
import { PaneComponentProps } from '../PaneComponentProps'

export const FieldSet = memo(function FieldSet({
  title,
  postTitle,
  displayValue,
  inputs,
  style,
}: PaneComponentProps.FieldSet) {
  const id = useId()

  return (
    <fieldset style={{ display: 'flex', flexFlow: 'column', ...style }}>
      <div style={{ display: 'flex' }}>
        <div>
          <label htmlFor={id}>{title}</label>
          {postTitle}
        </div>

        {displayValue && (
          <div
            style={{ marginLeft: 'auto' }}
            role="status"
            aria-aria-live="polite"
            aria-label={`Current ${title} value`}>
            {displayValue}
          </div>
        )}
      </div>

      {inputs}
    </fieldset>
  )
})
