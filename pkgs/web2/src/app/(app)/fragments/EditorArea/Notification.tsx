import { useNotifications } from '@/domains/notifications'
import { useTranslation } from '@/lib/i18n'
import { notificationTexts } from '@/locales'
import { memo, useRef, useState } from 'react'

export const Notification = memo(function Notification() {
  const t = useTranslation(notificationTexts)
  const timerIdRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [notify, setMessage] = useState<{
    key: number
    message: string
  } | null>(null)

  useNotifications((notify) => {
    let handled = false

    if (notify.type === 'toolChanged') {
      handled = true
      setMessage({
        key: Date.now(),
        message: t('toolChanged', {
          tool: t(`tools.${notify.tool}`),
        }),
      })
    } else if (notify.type === 'undo' || notify.type === 'redo') {
      handled = true
      setMessage({
        key: Date.now(),
        message: t(`history.${notify.type}`),
      })
    }

    if (handled) {
      window.clearTimeout(timerIdRef.current!)
      timerIdRef.current = window.setTimeout(() => setOpen(false), 800)

      setOpen(true)
    }
  })

  if (!notify) return null

  return (
    <div
      key={notify.key}
      css={`
        position: absolute;
        top: 16px;
        left: 50%;
        z-index: 2;
        padding: 8px;
        width: max-content;
        border-radius: 8px;
        color: var(--gray-2);
        opacity: 0;
        background-color: var(--gray-a9);
        transform: translateX(-50%);
        transition-property: opacity;
        transition: 0.2s ease-out;

        &[data-state-open='true'] {
          opacity: 1;
        }
      `}
      data-state-open={open}
      role="status"
    >
      {notify.message}
    </div>
  )
})
