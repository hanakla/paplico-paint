import { useFunk } from '@hanakla/arma'
import { Placement } from '@popperjs/core'
import { ArrowDownS, Check } from '@styled-icons/remix-line'
import { rgba } from 'polished'
import { useMemo, MouseEvent, useRef, useEffect } from 'react'
import { usePopper } from 'react-popper'
import { useToggle } from 'react-use'
import { css } from 'styled-components'

export const SelectBox = ({
  className,
  items,
  value,
  placement = 'top-start',
  placeholder,
  onChange,
}: {
  value?: string | null | undefined
  items: { label: string; value: string }[]
  className?: string
  placement?: Placement
  placeholder?: string
  onChange: (value: string) => void
}) => {
  const [listOpened, toggleListOpened] = useToggle(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const compositeModePopper = usePopper(rootRef.current, listRef.current, {
    strategy: 'fixed',
    placement,
  })

  const handleItemClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()

    toggleListOpened(false)
    onChange(e.currentTarget.dataset.value!)
  })

  const currentItem = useMemo(
    () => items.find((item) => item.value === value),
    [value]
  )

  useEffect(() => {
    if (!listOpened) return
    setTimeout(() => compositeModePopper.forceUpdate?.(), 100)
  }, [listOpened])

  return (
    <div
      ref={rootRef}
      css={css`
        position: relative;
        display: inline-block;
        min-width: 100px;
        padding: 4px;
        border: 1px solid #aaa;
        border-radius: 4px;
        background-color: ${({ theme }) => theme.exactColors.white40};
        color: ${({ theme }) => theme.exactColors.black50};

        &::placeholder {
          color: ${({ theme }) => theme.exactColors.black30};
        }
      `}
      className={className}
      onClick={toggleListOpened}
    >
      {currentItem?.label ?? (
        <span
          css={`
            opacity: 0.5;
          `}
        >
          {placeholder}
        </span>
      )}

      <ArrowDownS
        css={`
          position: absolute;
          right: 0;
          top: 50%;
          width: 16px;
          transform: translateY(-50%);
        `}
      />

      {/* <Portal> */}
      <div
        ref={listRef}
        css={css`
          width: max-content;
          background-color: ${({ theme }) => theme.surface.floatWhite};
          filter: drop-shadow(0 0 5px ${rgba('#000', 0.5)});
          border-radius: 4px;
          overflow: hidden;
        `}
        style={{
          ...(listOpened
            ? { visibility: 'visible', pointerEvents: 'all' }
            : { visibility: 'hidden', pointerEvents: 'none' }),
          ...compositeModePopper.styles.popper,
        }}
        {...compositeModePopper.attributes.popper}
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            css={css`
              padding: 8px 4px;
              padding-right: 8px;

              &:hover {
                color: ${({ theme }) => theme.exactColors.white50};
                background-color: ${({ theme }) =>
                  theme.exactColors.blueFade40};
              }
            `}
            onClick={handleItemClick}
            data-value={item.value}
          >
            <span
              css={`
                display: inline-block;
                margin-right: 4px;
                width: 12px;
                vertical-align: bottom;
              `}
            >
              {item.value === value && <Check css="width: 12px;" />}
            </span>
            {item.label}
          </div>
        ))}
      </div>
      {/* </Portal> */}
    </div>
  )
}

export const DropdownItem = () => {}
