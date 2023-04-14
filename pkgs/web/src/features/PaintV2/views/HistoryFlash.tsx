import { useTranslation } from 'next-i18next'
import { memo } from 'react'
import { keyframes } from 'styled-components'
import { useNotifyConsumer } from '🙌/domains/Notify'
import { ThemeProp } from '🙌/utils/theme'

export const HistoryFlash = memo(function HistoryFlash() {
  const { t } = useTranslation('app')
  const notifications = useNotifyConsumer('commandFlash', Infinity)

  return (
    <div
      css={`
        position: relative;
      `}
    >
      {notifications.map((notfiy) => (
        <div
          key={notfiy.id}
          css={`
            position: absolute;
            top: 0;
            left: 50%;
            z-index: 2;
            padding: 8px;
            width: max-content;
            border-radius: 8px;
            color: ${({ theme }: ThemeProp) => theme.exactColors.white60};
            background-color: ${({ theme }: ThemeProp) =>
              theme.exactColors.blackFade50};
            transform: translateX(-50%);
            animation: ${histolyFlashAnim} 1s ease-in-out 1 both;
          `}
        >
          {t(`commandFlash.${notfiy.messageKey}`)}
        </div>
      ))}
    </div>
  )
})

const histolyFlashAnim = keyframes`
  from {
    transform: translate(-50%, -16px);
    opacity: 0;
  }

  30% {
    transform: translate(-50%, 0);
    opacity: 1;
  }

  70% {
    transform: translate(-50%, 0);
    opacity: 1;
  }

  to {
    transform: translate(-50%, -16px);
    opacity: 0;
  }
`
