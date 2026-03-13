import { RiCloseFill } from 'react-icons/ri'
import { rgba } from 'polished'
import {
  createContext,
  DetailedHTMLProps,
  forwardRef,
  HTMLAttributes,
  KeyboardEvent,
  memo,
  MouseEvent,
  ReactNode,
  useContext,
  useEffect,
} from 'react'
import { animated, useSpring } from 'react-spring'
import { DOMUtils } from '@/utils/dom'
import useEvent from 'react-use-event-hook'
import { FocusTrap } from '@/components/FocusTrap'
import { GhostButton } from '@/components/GhostButton'
import { twx } from '@/utils/tailwind'

type Props = {
  opened: boolean
  className?: string
  heading?: ReactNode
  children?: ReactNode
  fill?: boolean
  backdrop?: boolean
  onClose: () => void
} & DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>

const ActionSheetContext = createContext<'fill' | 'split'>('fill')

export const ActionSheet = memo(
  forwardRef<HTMLDivElement, Props>(function ActionSheet(
    {
      opened,
      fill = true,
      backdrop = true,
      heading,
      children,
      className,
      onClose,
      ...props
    },
    ref,
  ) {
    const styles = useSpring({
      config: {
        duration: 150,
      },
      opacity: opened ? 1 : 0,
      transform: opened
        ? 'translateX(-50%) translateY(0%)'
        : 'translateX(-50%) translateY(100%)',
    })

    const backdropStyle = useSpring({
      config: {
        duration: 150,
      },
      opacity: opened ? 1 : 0,
    })

    const handleClickBackdrop = useEvent((e: MouseEvent<HTMLDivElement>) => {
      console.log(e.target, e.currentTarget)
      if (!DOMUtils.isSameElement(e.target, e.currentTarget)) return
      onClose()
    })

    const handleClickClose = useEvent(() => {
      onClose()
    })

    useEffect(() => {
      if (!opened) return

      const handleKeyDown = (e: globalThis.KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [opened])

    return (
      <ActionSheetContext.Provider value={fill ? 'fill' : 'split'}>
        <FocusTrap paused={!opened}>
          <div {...props} {...(fill ? { 'data-state-filled': true } : {})}>
            {backdrop && (
              <animated.div
                // backdrop
                className="fixed top-0 left-0 w-screen h-screen z-1 bg-black/50"
                style={{
                  ...backdropStyle,
                  pointerEvents: opened ? 'all' : 'none',
                }}
                onClick={handleClickBackdrop}
              />
            )}
            <animated.div
              ref={ref}
              className={twx(
                'fixed left-1/2 bottom-0 z-2 flex flex-col w-full max-w-[400px] p-3 pb-[max(16px,env(safe-area-inset-bottom,16px))] overflow-auto filter drop-shadow-[0_0_16px_rgba(0,0,0,0.2)]',
                fill &&
                  'min-h-[50vh] shadow-[0_0_8px_rgba(0,0,0,0.2)] backdrop-blur-md rounded',
                className,
              )}
              style={{
                ...styles,
                pointerEvents: opened ? 'all' : 'none',
                backgroundColor: fill ? 'var(--gray-2)' : 'transparent',
                // color: fill ? theme.exactColors.black50 : 'transparent',
              }}
            >
              <div>
                <div className="sticky flex items-center mb-3">
                  <div>{heading}</div>
                  <GhostButton
                    className={twx(
                      'right-2 flex ml-auto items-center justify-center p-1 bg-black/10 rounded-full',
                      'data-[state-filled=false]:bg-white data-[state-filled=false]:hover:bg-[var(--accent-3)]',
                    )}
                    onClick={handleClickClose}
                  >
                    <RiCloseFill
                      size={24}
                      className="opacity-40 fill-[var(--gray-12)]"
                    />
                  </GhostButton>
                </div>

                <div className="flex-1" tabIndex={-1}>
                  {children}
                </div>
              </div>
            </animated.div>
          </div>
        </FocusTrap>
      </ActionSheetContext.Provider>
    )
  }),
)

export const ActionSheetItemGroup = ({
  children,
  className,
}: {
  className?: string
  children: ReactNode
}) => {
  const sheetType = useContext(ActionSheetContext)

  return (
    <div
      className={twx(
        'backdrop-blur-md rounded overflow-hidden [&+&]:mt-2',
        sheetType === 'split' && 'shadow-[0_0_5px_rgba(0,0,0,0.5)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export const ActionSheetItem = ({
  children,
  className,
  ...props
}: {
  children: ReactNode
  className?: string
} & DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) => {
  const onKeydown = useEvent((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.currentTarget.click()
    }
  })

  return (
    <div
      className={twx(
        'p-5 text-center text-lg font-[var(--font-weight-medium)] select-none',
        'data-[state-filled=false]:bg-[var(--gray-2)] data-[state-filled=false]:rounded-lg data-[state-filled=false]:hover:bg-[var(--accent-3)]',
        '[&+&]:border-t [&+&]:border-[rgba(51,51,51,0.3)]',
        className,
      )}
      {...props}
      onKeyDown={onKeydown}
      tabIndex={0}
    >
      {children}
    </div>
  )
}
