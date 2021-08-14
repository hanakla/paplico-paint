import { useLysSlice } from '@fleur/lys'
import { Add, Eye, EyeClose } from '@styled-icons/remix-line'
import arrayMove from 'array-move'
import { useTranslation } from 'next-i18next'
import { rgba } from 'polished'
import { MouseEvent, useCallback, useRef } from 'react'
import { usePopper } from 'react-popper'
import {
  SortableContainer,
  SortableElement,
  SortEndHandler,
} from 'react-sortable-hoc'
import { useClickAway, useToggle } from 'react-use'
import { css } from 'styled-components'
import { SilkEntity } from '../../silk-core/src'
import {
  ContextMenu,
  ContextMenuArea,
  ContextMenuCallback,
  ContextMenuItem,
} from '../components/ContextMenu'
import { Portal } from '../components/Portal'
import { EditorSlice } from '../domains/Editor'
import { useMouseTrap } from '../hooks/useMouseTrap'
import { useSilkEngine } from '../hooks/useSilkEngine'

export const FilterView = () => {
  const { t } = useTranslation('app')
  const engine = useSilkEngine()
  const [editorState, editorActions] = useLysSlice(EditorSlice)
  const { activeLayer } = editorState

  const [listOpened, toggleListOpened] = useToggle(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const listPopRef = useRef<HTMLUListElement | null>(null)
  const listPopper = usePopper(listRef.current, listPopRef.current, {
    placement: 'bottom-end',
    strategy: 'fixed',
  })

  const handleClickOpenFilter = useCallback((e: MouseEvent<HTMLDivElement>) => {
    toggleListOpened()
  }, [])

  const handleClickAddFilter = useCallback(
    ({ currentTarget }: MouseEvent<HTMLLIElement>) => {
      toggleListOpened(false)

      if (!activeLayer) return

      const filterId = currentTarget.dataset.filterId!
      const filter = engine?.getFilterInstance(filterId)
      if (!filter) return

      editorActions.updateLayer(activeLayer.id, (layer) => {
        layer.filters.unshift(
          SilkEntity.Filter.create({ filterId, settings: filter.initialConfig })
        )
      })

      editorActions.rerenderCanvas()
    },
    [activeLayer, toggleListOpened]
  )

  const handleFilterSortEnd: SortEndHandler = useCallback((sort) => {
    if (!editorState.activeLayer) return

    editorActions.updateLayer(editorState.activeLayer.id, (layer) => {
      arrayMove.mutate(layer.filters, sort.oldIndex, sort.newIndex)
    })
  }, [])

  useClickAway(listPopRef, () => toggleListOpened(false))

  return (
    <div
      css={`
        display: flex;
        flex-flow: column;
        flex: 1;
      `}
    >
      <header
        css={css`
          display: flex;
          padding: 4px;
          border-top: 1px solid #73757c;
        `}
      >
        {t('layerFilter')}

        <div
          ref={listRef}
          css={`
            position: relative;
            margin-left: auto;
          `}
          onClick={handleClickOpenFilter}
        >
          <Add css="width:16px;" />

          <Portal>
            <ul
              ref={listPopRef}
              css={css`
                position: absolute;
                z-index: 1;
                width: 184px;
                background-color: ${({ theme }) => theme.surface.popupMenu};
                color: ${({ theme }) => theme.text.white};
                box-shadow: 0 0 4px ${rgba('#000', 0.5)};

                li {
                  padding: 8px;
                  user-select: none;
                }
                li:hover {
                  background-color: rgba(255, 255, 255, 0.2);
                }
              `}
              style={{
                ...listPopper.styles.popper,
                ...(listOpened
                  ? { visibility: 'visible', pointerEvents: 'all' }
                  : { visibility: 'hidden', pointerEvents: 'none' }),
              }}
              {...listPopper.attributes.popper}
            >
              {engine?.getFilters().map((filter) => (
                <li
                  key={filter.id}
                  onClick={handleClickAddFilter}
                  data-filter-id={filter.id}
                >
                  {t(`filter.${filter.id}`)}
                </li>
              ))}
            </ul>
          </Portal>
        </div>
      </header>

      {activeLayer && (
        <SortableFilterList
          filters={[...activeLayer.filters].reverse()}
          onSortEnd={handleFilterSortEnd}
          distance={2}
          lockAxis={'y'}
        />
      )}
    </div>
  )
}

const SortableFilterList = SortableContainer(function FilterList({
  filters,
}: {
  filters: SilkEntity.Filter[]
}) {
  const [, editorActions] = useLysSlice(EditorSlice)

  const rootRef = useRef<HTMLDivElement | null>(null)

  useMouseTrap(
    rootRef,
    [
      {
        key: ['del', 'backspace'],
        handler: () => {
          editorActions.deleteSelectedFilters()
        },
      },
    ],
    []
  )

  return (
    <div
      ref={rootRef}
      css={css`
        flex: 1;
        background-color: ${({ theme }) => theme.surface.sidebarList};
        outline: none;
      `}
      tabIndex={-1}
    >
      {filters.map((filter, idx) => (
        <SortableFilterItem key={filter.id} index={idx} filter={filter} />
      ))}
    </div>
  )
})

const SortableFilterItem = SortableElement(function FilterItem({
  filter,
}: {
  filter: SilkEntity.Filter
}) {
  const { t } = useTranslation('app')
  const [editorState, editorActions] = useLysSlice(EditorSlice)

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).matches('[data-ignore-click]')) return

      editorActions.setSelectedFilterIds({ [filter.id]: true })
    },
    [filter]
  )

  const handleToggleVisibility = useCallback(() => {
    if (!editorState.activeLayer) return

    editorActions.updateLayer(editorState.activeLayer.id, (layer) => {
      const targetFilter = layer.filters.find((f) => f.id === filter.id)
      if (!targetFilter) return

      targetFilter.visible = !targetFilter.visible
    })

    editorActions.rerenderCanvas()
  }, [filter])

  const handleClickRemove: ContextMenuCallback = useCallback(
    (_) => {
      if (!editorState.activeLayer) return

      editorActions.updateLayer(editorState.activeLayer.id, (layer) => {
        const idx = layer.filters.findIndex((f) => f.id === filter.id)
        if (idx === -1) return

        layer.filters.splice(idx, 1)
      })

      editorActions.rerenderCanvas()
    },
    [filter]
  )

  return (
    <ContextMenuArea>
      {(ref) => (
        <div
          ref={ref}
          css={css`
            z-index: 1; /* Sortしたときに隠れちゃう(絶望)ので */
            display: flex;
            gap: 4px;
            padding: 4px;
            background-color: ${({ theme }) => theme.surface.sidebarList};
            color: ${({ theme }) => theme.text.white};
          `}
          style={{
            backgroundColor: editorState.selectedFilterIds[filter.id]
              ? `rgba(255,255,255,.2)`
              : undefined,
          }}
          onClick={handleClick}
        >
          <div
            style={{
              ...(filter.visible ? {} : { opacity: 0.5 }),
            }}
            onClick={handleToggleVisibility}
            data-ignore-click
          >
            {filter.visible ? (
              <Eye
                css={`
                  width: 16px;
                  vertical-align: bottom;
                `}
              />
            ) : (
              <EyeClose
                css={`
                  width: 16px;
                  vertical-align: bottom;
                `}
              />
            )}
          </div>

          <div>{t(`filter.${filter.filterId}`)}</div>

          <ContextMenu>
            <ContextMenuItem onClick={handleClickRemove}>削除</ContextMenuItem>
          </ContextMenu>
        </div>
      )}
    </ContextMenuArea>
  )
})
