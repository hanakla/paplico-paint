import { ModalComponentType } from '@fleur/mordred'
import { ReactNode } from 'react'
import { Button } from '../components/Button'
import { ModalBase } from '../components/ModalBase'
import { Stack } from '../components/Stack'
import { tm } from '../utils/theme'

export const ConfirmModal: ModalComponentType<
  {
    message: ReactNode
    discardLabel: ReactNode
    confirmLabel: ReactNode
  },
  boolean
> = ({ message, discardLabel, confirmLabel }) => {
  return (
    <ModalBase
      // header={<h1>ドキュメントを開く</h1>}
      content={
        <div
          css={`
            ${tm((o) => [o.typography(14)])}
          `}
        >
          {message}
        </div>
      }
      footer={
        <Stack dir="horizontal">
          <Button kind="normal">{discardLabel}</Button>
          <Button kind="primary">{confirmLabel}</Button>
        </Stack>
      }
    />
  )
}
