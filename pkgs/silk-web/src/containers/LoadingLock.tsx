import { CheckboxCircle } from '@styled-icons/remix-fill'
import { useTranslation } from 'next-i18next'
import { rgba } from 'polished'
import { useEffect, useState } from 'react'
import { css } from 'styled-components'
import { Portal } from '🙌/components/Portal'
import { useNotifyConsumer } from '🙌/domains/Notify'
import { centering } from '🙌/utils/mixins'
import { tm } from '🙌/utils/theme'

export const LoadingLock = () => {
  const { t } = useTranslation('app')
  const [notify] = useNotifyConsumer('loadingLock', 1)
  const [visible, setVisible] = useState(false)
  const [complete, setComplete] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!notify || notify.area !== 'loadingLock') return

    setMessage(notify.messageKey === '' ? '' : t(`notify.${notify.messageKey}`))

    if (notify.lock) {
      setVisible(true)
    } else {
      setComplete(true)

      window.setTimeout(() => {
        setVisible(false)

        window.setTimeout(() => {
          setComplete(false)
        }, 200)
      }, 1000)
    }
  })

  return (
    <Portal>
      <div
        css={`
          position: fixed;
          top: 0;
          left: 0;
          z-index: 100;
          ${centering()}
          padding: 16px;
          width: 100vw;
          height: 100vh;
          background-color: ${rgba('#000', 0.6)};

          transition: 0.2s ease-in-out;
          transition-property: opacity;
        `}
        style={
          visible
            ? { opacity: 1, pointerEvents: 'all' }
            : { opacity: 0, pointerEvents: 'none' }
        }
      >
        <div
          css={css`
            margin: 0 auto;
            padding: 24px;
            background-color: ${({ theme }) => theme.exactColors.white30};
            text-align: center;
            border-radius: 4px;
          `}
        >
          {!complete ? (
            <div
              css={css`
                border-radius: 50%;
                width: 48px;
                height: 48px;

                & {
                  margin: 0 auto;
                  font-size: 10px;
                  position: relative;
                  text-indent: -9999em;
                  border-top: 6px solid
                    ${({ theme }) => rgba(theme.color.brand, 0.2)};
                  border-right: 6px solid
                    ${({ theme }) => rgba(theme.color.brand, 0.2)};
                  border-bottom: 6px solid
                    ${({ theme }) => rgba(theme.color.brand, 0.2)};
                  border-left: 6px solid
                    ${({ theme }) => rgba(theme.color.brand, 1)};
                  transform: translateZ(0);
                  animation: load8 0.6s infinite linear;
                }

                @keyframes load8 {
                  0% {
                    -webkit-transform: rotate(0deg);
                    transform: rotate(0deg);
                  }
                  100% {
                    -webkit-transform: rotate(360deg);
                    transform: rotate(360deg);
                  }
                }
              `}
            />
          ) : (
            <CheckboxCircle
              css={css`
                color: ${({ theme }) => theme.exactColors.success};
              `}
              width={48}
            />
          )}

          <div
            css={`
              margin-top: 24px;
              ${tm((o) => [o.typography(16).bold])}
            `}
          >
            {message}
          </div>
        </div>
      </div>
    </Portal>
  )
}
