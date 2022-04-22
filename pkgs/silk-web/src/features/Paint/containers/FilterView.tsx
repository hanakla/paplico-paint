import { Add, ArrowDownS } from '@styled-icons/remix-line'
import { Eye, EyeClose } from '@styled-icons/remix-fill'
import arrayMove from 'array-move'
import { useTranslation } from 'next-i18next'
import { rgba } from 'polished'
import { memo, MouseEvent, useRef } from 'react'
import {
  SortableContainer,
  SortableElement,
  SortEndHandler,
} from 'react-sortable-hoc'
import { useClickAway, useToggle } from 'react-use'
import { useTheme } from 'styled-components'
import { css } from 'styled-components'
import { SilkDOM } from 'silk-core'
import { ContextMenu, ContextMenuItem } from '🙌/components/ContextMenu'
import { Portal } from '🙌/components/Portal'
import { useMouseTrap } from '🙌/hooks/useMouseTrap'
import { DOMUtils } from '🙌/utils/dom'
import { centering } from '🙌/utils/mixins'
import { FilterSettings } from './FilterSettings'
import { useFleurContext, useStore } from '@fleur/react'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useFunk } from '@hanakla/arma'
import { isEventIgnoringTarget } from '../helpers'
import { SidebarPane } from '🙌/components/SidebarPane'
import { reversedIndex } from '🙌/utils/array'
import { offset, shift, useFloating } from '@floating-ui/react-dom'

export const FilterView = memo(() => {
  const { t } = useTranslation('app')

  const { executeOperation, getStore } = useFleurContext()
  const { activeLayer, activeLayerPath, registeredFilters } = useStore(
    (get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      activeLayerPath: EditorSelector.activeLayerPath(get),
      registeredFilters: EditorSelector.getAvailableFilters(get),
    })
  )

  const [listOpened, toggleListOpened] = useToggle(false)
  const listfl = useFloating({
    placement: 'bottom-end',
    strategy: 'fixed',
    middleware: [shift(), offset(4)],
  })

  const handleClickOpenFilter = useFunk((e: MouseEvent<HTMLDivElement>) => {
    // if (DOMUtils.isChildren( e.currentTarget)) return
    toggleListOpened()
  })

  const handleClickAddFilter = useFunk(
    ({ currentTarget, nativeEvent }: MouseEvent<HTMLLIElement>) => {
      nativeEvent.stopPropagation()
      toggleListOpened(false)

      if (!activeLayer) return

      const filterId = currentTarget.dataset.filterId!
      const filter = EditorSelector.getFilterInstance(getStore, filterId)
      if (!filter) return

      executeOperation(EditorOps.updateLayer, activeLayerPath, (layer) => {
        layer.filters.unshift(
          SilkDOM.Filter.create({ filterId, settings: filter.initialConfig })
        )
      })

      executeOperation(EditorOps.rerenderCanvas)
    }
  )

  const handleFilterSortEnd: SortEndHandler = useFunk((sort) => {
    if (!activeLayer || !activeLayerPath) return

    executeOperation(EditorOps.updateLayer, activeLayerPath, (layer) => {
      // arrayMove.mutate(
      //   layer.filters,
      //   reversedIndex(activeLayer.filters, sort.oldIndex),
      //   reversedIndex(activeLayer.filters, sort.newIndex)
      // )
      arrayMove.mutate(layer.filters, sort.oldIndex, sort.newIndex)
    })
  })

  useClickAway(listfl.refs.floating, (e) => {
    if (isEventIgnoringTarget(e.target)) return
    toggleListOpened(false)
  })

  return (
    <SidebarPane
      heading={
        <>
          {t('layerFilter')}

          <div
            ref={listfl.reference}
            css={`
              position: relative;
              margin-left: auto;
            `}
            onClick={handleClickOpenFilter}
          >
            <Add css="width:16px;" />

            <Portal>
              <ul
                ref={listfl.floating}
                css={css`
                  position: fixed;
                  z-index: 1;
                  width: 184px;
                  background-color: ${({ theme }) => theme.surface.popupMenu};
                  color: ${({ theme }) => theme.text.white};
                  box-shadow: 0 0 4px ${rgba('#000', 0.5)};
                  border-radius: 4px;

                  li {
                    padding: 8px;
                    user-select: none;
                  }
                  li:hover {
                    background-color: rgba(255, 255, 255, 0.2);
                  }
                `}
                style={{
                  position: listfl.strategy,
                  left: listfl.x ?? 0,
                  top: listfl.y ?? 0,
                  ...(listOpened
                    ? { visibility: 'visible', pointerEvents: 'all' }
                    : { visibility: 'hidden', pointerEvents: 'none' }),
                }}
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
      container={(children) => children}
    >
      {activeLayer && (
        <SortableFilterList
          layer={activeLayer}
          filters={activeLayer.filters}
          onSortEnd={handleFilterSortEnd}
          distance={2}
          lockAxis={'y'}
        />
      )}
    </SidebarPane>
  )
})

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
          executeOperation(EditorOps.deleteSelectedFilters)
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
  const { activeLayer, activeLayerPath, selectedFilterIds } = useStore(
    (get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      activeLayerPath: EditorSelector.activeLayerPath(get),
      selectedFilterIds: get(EditorStore).state.selectedFilterIds,
    })
  )

  const active = selectedFilterIds[filter.uid]
  const [propsOpened, togglePropsOpened] = useToggle(false)

  const handleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return

    executeOperation(EditorOps.setSelectedFilterIds, { [filter.uid]: true })
  })

  const handleDoubleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return
    togglePropsOpened()
  })

  const handleToggleVisibility = useFunk(() => {
    if (!activeLayer || !activeLayerPath) return

    executeOperation(EditorOps.updateLayer, activeLayerPath, (layer) => {
      const targetFilter = layer.filters.find((f) => f.uid === filter.uid)
      if (!targetFilter) return

      targetFilter.visible = !targetFilter.visible
    })

    executeOperation(EditorOps.rerenderCanvas)
  })

  const handleClickRemove = useFunk(() => {
    if (!activeLayer || !activeLayerPath) return

    executeOperation(EditorOps.updateLayer, activeLayerPath, (layer) => {
      const idx = layer.filters.findIndex((f) => f.uid === filter.uid)
      if (idx === -1) return

      layer.filters.splice(idx, 1)
    })

    executeOperation(EditorOps.rerenderCanvas)
  })

  return (
    <div
      css={css`
        z-index: 1; /* Sortしたときに隠れちゃう(絶望)ので */
        display: flex;
        flex-wrap: wrap;
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
          backgroundColor: active ? theme.surface.sidebarListActive : undefined,
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
  )
})
