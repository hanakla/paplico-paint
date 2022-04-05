import { Add, ArrowDownS } from '@styled-icons/remix-line'
import { Eye, EyeClose } from '@styled-icons/remix-fill'
import arrayMove from 'array-move'
import { useTranslation } from 'next-i18next'
import { rgba } from 'polished'
import { MouseEvent, useRef } from 'react'
import { usePopper } from 'react-popper'
import {
  SortableContainer,
  SortableElement,
  SortEndHandler,
} from 'react-sortable-hoc'
import { useClickAway, useToggle } from 'react-use'
import { useTheme } from 'styled-components'
import { css } from 'styled-components'
import { SilkDOM } from 'silk-core'
import {
  ContextMenu,
  ContextMenuArea,
  ContextMenuCallback,
  ContextMenuItem,
} from '🙌/components/ContextMenu'
import { Portal } from '🙌/components/Portal'
import { useMouseTrap } from '🙌/hooks/useMouseTrap'
import { DOMUtils } from '🙌/utils/dom'
import { centering } from '🙌/utils/mixins'
import { FilterSettings } from './FilterSettings'
import { useFleurContext, useStore } from '@fleur/react'
import { editorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useFunk } from '@hanakla/arma'
import { isEventIgnoringTarget } from '../helpers'
import { SidebarPane } from '🙌/components/SidebarPane'
import { reversedIndex } from '🙌/utils/array'

export const FilterView = () => {
  const { t } = useTranslation('app')

  const { executeOperation, getStore } = useFleurContext()
  const { activeLayer, registeredFilters } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    registeredFilters: EditorSelector.getAvailableFilters(get),
  }))

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

  const handleClickOpenFilter = useFunk((e: MouseEvent<HTMLDivElement>) => {
    toggleListOpened()
  })

  const handleClickAddFilter = useFunk(
    ({ currentTarget }: MouseEvent<HTMLLIElement>) => {
      toggleListOpened(false)

      if (!activeLayer) return

      const filterId = currentTarget.dataset.filterId!
      const filter = EditorSelector.getFilterInstance(getStore, filterId)
      if (!filter) return

      executeOperation(editorOps.updateLayer, activeLayer.uid, (layer) => {
        layer.filters.unshift(
          SilkDOM.Filter.create({ filterId, settings: filter.initialConfig })
        )
      })

      executeOperation(editorOps.rerenderCanvas)
    }
  )

  const handleFilterSortEnd: SortEndHandler = useFunk((sort) => {
    if (!activeLayer) return

    executeOperation(editorOps.updateLayer, activeLayer.uid, (layer) => {
      arrayMove.mutate(
        layer.filters,
        reversedIndex(activeLayer.filters, sort.oldIndex),
        reversedIndex(activeLayer.filters, sort.newIndex)
      )
    })
  })

  useClickAway(addFilterListPopRef, (e) => {
    if (isEventIgnoringTarget(e.target)) return
    toggleListOpened(false)
  })

  return (
    <SidebarPane
      heading={
        <>
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
                {registeredFilters.map((filter) => (
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
        </>
      }
    >
      {activeLayer && (
        <SortableFilterList
          layer={activeLayer}
          filters={[...activeLayer.filters].reverse()}
          onSortEnd={handleFilterSortEnd}
          distance={2}
          lockAxis={'y'}
        />
      )}
    </SidebarPane>
  )
}

const SortableFilterList = SortableContainer(function FilterList({
  layer,
  filters,
}: {
  layer: SilkDOM.LayerTypes
  filters: SilkDOM.Filter[]
}) {
  const { executeOperation } = useFleurContext()

  const rootRef = useRef<HTMLDivElement | null>(null)

  useMouseTrap(
    rootRef,
    [
      {
        key: ['del', 'backspace'],
        handler: () => {
          executeOperation(editorOps.deleteSelectedFilters)
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
          key={filter.uid}
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
  layer: SilkDOM.LayerTypes
  filter: SilkDOM.Filter
}) {
  const { t } = useTranslation('app')
  const theme = useTheme()

  const { executeOperation } = useFleurContext()
  const { activeLayer, selectedFilterIds } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    selectedFilterIds: get(EditorStore).state.selectedFilterIds,
  }))

  const active = selectedFilterIds[filter.uid]
  const [propsOpened, togglePropsOpened] = useToggle(false)

  const handleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return

    executeOperation(editorOps.setSelectedFilterIds, { [filter.uid]: true })
  })

  const handleDoubleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return
    togglePropsOpened()
  })

  const handleToggleVisibility = useFunk(() => {
    if (!activeLayer) return

    executeOperation(editorOps.updateLayer, activeLayer.uid, (layer) => {
      const targetFilter = layer.filters.find((f) => f.uid === filter.uid)
      if (!targetFilter) return

      targetFilter.visible = !targetFilter.visible
    })

    executeOperation(editorOps.rerenderCanvas)
  })

  const handleClickRemove: ContextMenuCallback = useFunk((_) => {
    if (!activeLayer) return

    executeOperation(editorOps.updateLayer, activeLayer.uid, (layer) => {
      const idx = layer.filters.findIndex((f) => f.uid === filter.uid)
      if (idx === -1) return

      layer.filters.splice(idx, 1)
    })

    executeOperation(editorOps.rerenderCanvas)
  })

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
