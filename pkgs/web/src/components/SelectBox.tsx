import {
  autoUpdate,
  flip,
  offset,
  Placement,
  shift,
  useFloating,
} from '@floating-ui/react-dom'
import { useFunk } from '@hanakla/arma'
import { ArrowDownS, Check } from '@styled-icons/remix-line'
import { rgba } from 'polished'
import { useMemo, MouseEvent, useEffect, ReactNode } from 'react'
import { useClickAway, useToggle } from 'react-use'
import { css } from 'styled-components'
import { Portal } from './Portal'

export declare namespace SelectBox {
  export type OnChangeHandler = (value: string) => void
}

export const SelectBox = ({
  className,
  items,
  value,
  placement = 'top-start',
  placeholder,
  disabled,
  onChange,
}: {
  value?: string | null | undefined
  items: { label: ReactNode; value: string }[]
  className?: string
  placement?: Placement
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
}) => {
  const [listOpened, toggleListOpened] = useToggle(false)

  const listFl = useFloating({
    strategy: 'fixed',
    placement,
    middleware: [offset(4), shift({ padding: 4 }), flip()],
  })

  const handleClickBox = useFunk(() => {
    if (disabled) return
    toggleListOpened()
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
    if (!listFl.refs.reference.current || !listFl.refs.floating.current) return

    return autoUpdate(
      listFl.refs.reference.current,
      listFl.refs.floating.current,
      listFl.update
    )
  }, [listFl.refs.reference, listFl.refs.floating, listFl.update, listOpened])

  useClickAway(listFl.refs.floating, () => toggleListOpened(false))

  return (
    <div
      ref={listFl.reference}
      css={css`
        position: relative;
        display: block;
        width: 100%;
        min-width: 100px;
        padding: 4px;
        padding-right: 16px;
        border: 1px solid ${rgba('#aaa', 0.2)};
        border-radius: 4px;
        background-color: ${({ theme }) => theme.color.surface3};
        color: ${({ theme }) => theme.color.text2};

        &::placeholder {
          color: ${({ theme }) => theme.exactColors.black30};
        }
      `}
      className={className}
      onClick={handleClickBox}
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

      <Portal>
        <div
          ref={listFl.floating}
          css={css`
            width: max-content;
            background-color: ${({ theme }) =>
              rgba(theme.color.background2, 1)};
            filter: drop-shadow(0 0 5px ${rgba('#000', 0.5)});
            border-radius: 4px;
            overflow: hidden;
          `}
          style={{
            position: listFl.strategy,
            left: listFl.x ?? 0,
            top: listFl.y ?? 0,
            ...(listOpened
              ? { visibility: 'visible', pointerEvents: 'all' }
              : { visibility: 'hidden', pointerEvents: 'none' }),
          }}
        >
          {items.map((item, idx) => (
            <div
              key={idx}
              css={css`
                display: flex;
                padding: 8px 4px;
                padding-right: 8px;
                color: ${({ theme }) => theme.color.text2};

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
      </Portal>
    </div>
  )
}

export const DropdownItem = () => {}
