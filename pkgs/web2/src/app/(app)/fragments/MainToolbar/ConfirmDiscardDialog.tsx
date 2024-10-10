import { DialogProps } from '@/components/Dialog'
import { Button, Dialog, Flex, Grid } from '@radix-ui/themes'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'

type Props = DialogProps<boolean>

export const ConfirmDiscardDialog = function FileSaveDialog({
  onClose,
}: Props) {
  const handleCancel = useEvent(() => {
    onClose(false)
  })

  const handleDiscard = useEvent(() => {
    onClose(true)
  })

  return (
    <Dialog.Root open onOpenChange={handleCancel}>
      <Dialog.Content>
        <Dialog.Title>Caution</Dialog.Title>

        <Grid gap="4">Would you like to discard your changes?</Grid>

        <Flex gap="3" justify="end" mt="8">
          <Button color="gray" variant="soft" onClick={handleDiscard}>
            Discard
          </Button>
          <Button color="gray" variant="soft" onClick={handleCancel}>
            Cancel
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
