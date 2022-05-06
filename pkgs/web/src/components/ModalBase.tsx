import { ReactNode } from 'react'
import { tm } from '../utils/theme'

type Props = {
  header?: ReactNode
  content: ReactNode
  footer?: ReactNode
}

export const ModalBase = ({ header, content, footer }: Props) => {
  return (
    <div
      css={`
        flex: none;
        width: 50vw;
        min-width: 300px;
        margin: auto;
        border-radius: 8px;
        ${tm((o) => [o.bg.surface2, o.font.text2])}
      `}
    >
      {header && (
        <div
          css={`
            padding: 16px 16px 0;
            h1 {
              text-align: center;
              ${tm((o) => [o.typography(16).bold])}
            }
          `}
        >
          {header}
        </div>
      )}

      <div
        css={`
          padding: 16px;
        `}
      >
        {content}
      </div>

      {footer && (
        <div
          css={`
            padding: 0 16px 16px;
          `}
        >
          {footer}
        </div>
      )}
    </div>
  )
}
