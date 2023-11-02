import { DialogProps } from '@/components/Dialog'
import { Button, Dialog, Flex, Grid } from '@radix-ui/themes'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'

type Result = { type: 'paplic' | 'png' } | { type: 'psd' }
type Props = DialogProps<Result>

export const FileSaveDialog = function FileSaveDialog({ onClose }: Props) {
  const handleCancel = useEvent(() => {
    onClose()
  })

  const handleClickType = useEvent((e: React.MouseEvent<HTMLButtonElement>) => {
    const type = e.currentTarget.dataset.type!
    console.log(type)
    onClose({ type })
  })

  return (
    <Dialog.Root open onOpenChange={handleCancel}>
      <Dialog.Content>
        <Dialog.Title>Caution</Dialog.Title>

        <Grid gap="4">
          <Button variant="soft" data-type="paplic" onClick={handleClickType}>
            Save as .paplic
          </Button>
          <Button variant="soft" data-type="png" onClick={handleClickType}>
            Save as PNG
          </Button>
          <Button variant="soft" data-type="psd" onClick={handleClickType}>
            Save as PSD
          </Button>
        </Grid>

        <Flex gap="3" justify="end" mt="8">
          <Button color="gray" variant="soft" onClick={handleCancel}>
            Cancel
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
