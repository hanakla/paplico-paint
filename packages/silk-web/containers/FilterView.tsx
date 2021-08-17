import { useLysSlice } from '@fleur/lys'
import { Add, ArrowDownS } from '@styled-icons/remix-line'
import { Eye, EyeClose } from '@styled-icons/remix-fill'
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
import { useTheme } from 'styled-components'
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
import { DOMUtils } from '../utils/dom'
import { centering } from '../utils/mixins'
import { FilterSettings } from './FilterSettings'

export const FilterView = () => {
  const { t } = useTranslation('app')
  const engine = useSilkEngine()
  const [editorState, editorActions] = useLysSlice(EditorSlice)
  const { activeLayer } = editorState

  const [listOpened, toggleListOpened] = useToggle(false)
  const addFilterListRef = useRef<HTMLDivElement | null>(null)
  const addFilterListPopRef = useRef<HTMLUListElement | null>(null)
  const addLayerListPopper = usePopper(
    addFilterListRef.current,
    addFilterListPopRef.current,
    {
      placement: 'bottom-end',
      strategy: 'fixed',
    }
  )

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

  useClickAway(addFilterListPopRef, () => toggleListOpened(false))

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
          ${centering()}
          display: flex;
          /* height: 24px; */
          padding: 6px;
          border-top: 1px solid ${({ theme }) => theme.exactColors.blackFade30};
          border-bottom: 1px solid
            ${({ theme }) => theme.exactColors.blackFade30};
        `}
      >
        {t('layerFilter')}

        <div
          ref={addFilterListRef}
          css={`
            position: relative;
            margin-left: auto;
          `}
          onClick={handleClickOpenFilter}
        >
          <Add css="width:16px;" />

          <Portal>
            <ul
              ref={addFilterListPopRef}
              css={css`
                position: fixed;
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
                ...addLayerListPopper.styles.popper,
                ...(listOpened
                  ? { visibility: 'visible', pointerEvents: 'all' }
                  : { visibility: 'hidden', pointerEvents: 'none' }),
              }}
              {...addLayerListPopper.attributes.popper}
            >
              {engine?.getFilters().map((filter) => (
                <li
                  key={filter.id}
                  onClick={handleClickAddFilter}
                  data-filter-id={filter.id}
                >
                  {t(`filters.${filter.id}`)}
                </li>
              ))}
            </ul>
          </Portal>
        </div>
      </header>

      {activeLayer && (
        <SortableFilterList
          layer={activeLayer}
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
  layer,
  filters,
}: {
  layer: SilkEntity.LayerTypes
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
        background-color: ${({ theme }) => theme.colors.black50};
        outline: none;
      `}
      tabIndex={-1}
    >
      {filters.map((filter, idx) => (
        <SortableFilterItem
          key={filter.id}
          index={idx}
          layer={layer}
          filter={filter}
        />
      ))}
    </div>
  )
})

const SortableFilterItem = SortableElement(function FilterItem({
  layer,
  filter,
}: {
  layer: SilkEntity.LayerTypes
  filter: SilkEntity.Filter
}) {
  const { t } = useTranslation('app')
  const theme = useTheme()
  const [editorState, editorActions] = useLysSlice(EditorSlice)

  const active = editorState.selectedFilterIds[filter.id]
  const [propsOpened, togglePropsOpened] = useToggle(false)

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return

      editorActions.setSelectedFilterIds({ [filter.id]: true })
    },
    [filter]
  )

  const handleDoubleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return
    togglePropsOpened()
  }, [])

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
            flex-wrap: wrap;

            background-color: ${({ theme }) => theme.colors.black50};
            color: ${({ theme }) => theme.text.white};
          `}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        >
          <div
            css={`
              display: flex;
              flex: 1;
              padding: 4px;
            `}
            style={{
              backgroundColor: active
                ? theme.surface.sidebarListActive
                : undefined,
            }}
          >
            <div
              css={`
                ${centering}
                flex: none;
                width: 12px;
              `}
              data-ignore-click
            >
              <ArrowDownS
                css={`
                  width: 12px;
                `}
                style={{
                  transform: propsOpened ? 'rotateZ(180deg)' : 'rotateZ(0)',
                }}
                onClick={togglePropsOpened}
              />
            </div>

            <div
              css={`
                ${centering()}
                padding: 4px;
              `}
              style={{
                ...(filter.visible ? {} : { opacity: 0.5 }),
              }}
              onClick={handleToggleVisibility}
              data-ignore-click
            >
              {filter.visible ? (
                <Eye
                  css={css`
                    width: 16px;
                    vertical-align: bottom;
                    color: ${({ theme }) => theme.colors.white10};
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

            <div
              css={`
                ${centering()}
              `}
            >
              {t(`filters.${filter.filterId}`)}
            </div>
          </div>

          <div
            css={`
              flex-basis: 100%;
            `}
          />

          {propsOpened && (
            <div
              css={`
                padding: 8px;
                padding-left: 24px;
              `}
              data-ignore-click
            >
              <FilterSettings layer={layer} filter={filter}></FilterSettings>
            </div>
          )}

          <ContextMenu>
            <ContextMenuItem onClick={handleClickRemove}>削除</ContextMenuItem>
          </ContextMenu>
        </div>
      )}
    </ContextMenuArea>
  )
})
