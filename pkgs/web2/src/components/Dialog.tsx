import {
  ComponentProps,
  ReactNode,
  RefObject,
  createContext,
  memo,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Dialog as _Dialog } from '@radix-ui/themes'
import { ComponentType } from 'react-spring'

export type DialogProps<T> = {
  onClose: (result?: T) => void
}

export function useModal() {
  const modalCtx = useContext(ModalContext)

  return useCallback(
    <T extends ComponentType<DialogProps<any>>>(
      Component: T,
      props: Omit<ComponentProps<T>, 'onClose'>,
    ) => {
      type ModalResultType = Parameters<ComponentProps<T>['onClose']>[0]

      return new Promise<ModalResultType>((resolve) => {
        let id: string

        const onClose = (result?: ModalResultType) => {
          modalCtx!.close(id)
          resolve(result)
        }

        id = modalCtx!.open(Component, {
          ...props,
          onClose,
        } as ComponentProps<T>)
      })
    },
    [],
  )
}

type ModalState = {
  open: <T extends ComponentType<DialogProps<any>>>(
    Component: T,
    props: ComponentProps<T>,
  ) => string
  close: (id: string) => void
}

const ModalContext = createContext<ModalState | null>(null)

export const ModalProvider = memo(({ children }: { children: ReactNode }) => {
  const [modals, setModals] = useState<Record<string, ReactNode>>({})

  const modalCtx = useMemo(
    (): ModalState => ({
      open(Component, props) {
        const id =
          Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15)

        setModals((prev) => ({
          ...prev,
          [id]: <Component key={id} {...(props as any)} />,
        }))
        return id
      },
      close(id) {
        console.log('close')
        setModals((prev) => {
          const { [id]: _, ...rest } = prev
          return rest
        })
      },
    }),
    [],
  )

  return (
    <ModalContext.Provider value={modalCtx}>
      {children}
      <div style={{ width: 0, height: 0, display: 'contents' }}>
        {Object.values(modals)}
      </div>
    </ModalContext.Provider>
  )
})

export const Dialog = memo(function Dialog() {
  return (
    <_Dialog.Root>
      <_Dialog.Trigger>
        <Button>Edit profile</Button>
      </_Dialog.Trigger>

      <_Dialog.Content style={{ maxWidth: 450 }}>
        <_Dialog.Title>Edit profile</_Dialog.Title>
        <_Dialog.Description size="2" mb="4">
          Make changes to your profile.
        </_Dialog.Description>

        <Flex direction="column" gap="3">
          <label>
            <Text as="div" size="2" mb="1" weight="bold">
              Name
            </Text>
            <TextField.Input
              defaultValue="Freja Johnsen"
              placeholder="Enter your full name"
            />
          </label>
          <label>
            <Text as="div" size="2" mb="1" weight="bold">
              Email
            </Text>
            <TextField.Input
              defaultValue="freja@example.com"
              placeholder="Enter your email"
            />
          </label>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <_Dialog.Close>
            <Button variant="soft" color="gray">
              Cancel
            </Button>
          </_Dialog.Close>
          <_Dialog.Close>
            <Button>Save</Button>
          </_Dialog.Close>
        </Flex>
      </_Dialog.Content>
    </_Dialog.Root>
  )
})
