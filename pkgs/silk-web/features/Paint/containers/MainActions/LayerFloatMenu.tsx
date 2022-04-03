import type {} from '🙌/utils/styled-theme'

import {
  Add,
  DeleteBin,
  Eye,
  EyeClose,
  Menu,
  More,
  Magic,
} from '@styled-icons/remix-line'
import { Magic as MagicFill } from '@styled-icons/remix-fill'
import { useTranslation } from 'next-i18next'
import { rgba } from 'polished'
import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from 'react'
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
  SortEndHandler,
} from 'react-sortable-hoc'
import { css, useTheme } from 'styled-components'
import { Silk, SilkEntity } from 'silk-core'
import { useFleurContext, useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'

import { Portal } from '🙌/components/Portal'
import { useLayerControl } from '🙌/hooks/useLayers'
import { centering, rangeThumb, silkScroll } from '🙌/utils/mixins'
import { useClickAway, useToggle, useUpdate } from 'react-use'
import { usePopper } from 'react-popper'
import { SelectBox } from '🙌/components/SelectBox'
import { FakeInput } from '🙌/components/FakeInput'
import {
  ActionSheet,
  ActionSheetItemGroup,
  ActionSheetItem,
} from '🙌/components/ActionSheet'
import { FilterSettings } from '../FilterSettings'
import { DOMUtils } from '🙌/utils/dom'
import { editorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { isEventIgnoringTarget } from '../../helpers'

export const LayerFloatMenu = () => {
  const { t } = useTranslation('app')
  const layerControl = useLayerControl()

  const { executeOperation } = useFleurContext()
  const { currentDocument, activeLayer } = useStore((get) => ({
    currentDocument: EditorSelector.currentDocument(get),
    activeLayer: EditorSelector.activeLayer(get),
  }))
  const [addLayerSheetOpened, toggleAddLayerSheetOpened] = useToggle(false)

  const handleChangeCompositeMode = useFunk((mode: string) => {
    executeOperation(editorOps.updateLayer, activeLayer?.id, (layer) => {
      layer.compositeMode = mode as any
    })
  })

  const handleChangeOpacity = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      executeOperation(editorOps.updateLayer, activeLayer?.id, (layer) => {
        layer.opacity = currentTarget.valueAsNumber
      })
    }
  )

  const handleLayerSortEnd: SortEndHandler = useFunk((sort) => {
    layerControl.moveLayer(sort.oldIndex, sort.newIndex)
  })

  const handleClickAddLayer = useFunk(() => {
    toggleAddLayerSheetOpened(true)
  })

  const handleClickAddLayerItem = useFunk(
    ({ currentTarget }: MouseEvent<HTMLDivElement>) => {
      if (!currentDocument) return

      const layerType = currentTarget.dataset
        .layerType! as SilkEntity.LayerTypes['layerType']
      const { width, height } = currentDocument

      let layer: SilkEntity.LayerTypes
      switch (layerType) {
        case 'raster': {
          layer = SilkEntity.RasterLayer.create({ width, height })
          break
        }
        case 'vector': {
          layer = SilkEntity.VectorLayer.create({})
          break
        }
        case 'filter': {
          layer = SilkEntity.FilterLayer.create({})
          break
        }
        default:
          throw new Error('なんかおかしなっとるで')
      }

      executeOperation(editorOps.addLayer, layer, {
        aboveLayerId: activeLayer?.id ?? null,
      })
      toggleAddLayerSheetOpened(false)
    },
    [currentDocument, activeLayer]
  )

  const handleClickRemoveLayer = useFunk(() => {
    executeOperation(editorOps.deleteLayer, activeLayer?.id)
  })

  const addLayerSheetRef = useRef<HTMLDivElement | null>(null)
  const handleCloseAddLayerSheet = useFunk(() => {
    toggleAddLayerSheetOpened(false)
  })

  useClickAway(addLayerSheetRef, (e) => {
    if (isEventIgnoringTarget(e.target)) return
    toggleAddLayerSheetOpened(false)
  })

  return (
    <div
      css={`
        padding: 8px 4px;
      `}
    >
      <div>
        <SortableLayerList
          layers={[...(currentDocument?.layers ?? [])].reverse()}
          onSortEnd={handleLayerSortEnd}
          distance={1}
          // hideSortableGhost
          useDragHandle
          axis="y"
        />
        <div
          css={`
            display: flex;
            align-items: center;
            justify-content: center;
          `}
        >
          <div
            css={`
              flex: 1;
              text-align: center;
            `}
            onClick={handleClickAddLayer}
          >
            <Add
              css={`
                width: 24px;
                padding-bottom: 2px;
              `}
            />{' '}
            レイヤーを追加
          </div>

          <Portal>
            <ActionSheet
              ref={addLayerSheetRef}
              opened={addLayerSheetOpened}
              fill={false}
              onClose={handleCloseAddLayerSheet}
            >
              <div
                css={`
                  padding-top: 16px;

                  div + div {
                    border-top: 1px solid ${rgba('#000', 0.2)};
                  }
                `}
              >
                <ActionSheetItemGroup>
                  <div
                    onClick={handleClickAddLayerItem}
                    data-layer-type="raster"
                  >
                    <ActionSheetItem>{t('layerType.raster')}</ActionSheetItem>
                  </div>
                  <div
                    onClick={handleClickAddLayerItem}
                    data-layer-type="vector"
                  >
                    <ActionSheetItem>{t('layerType.vector')}</ActionSheetItem>
                  </div>
                  <div
                    onClick={handleClickAddLayerItem}
                    data-layer-type="filter"
                  >
                    <ActionSheetItem>{t('layerType.filter')}</ActionSheetItem>
                  </div>
                </ActionSheetItemGroup>

                <ActionSheetItemGroup>
                  <div
                    css={`
                      font-weight: bold;
                    `}
                    onClick={handleCloseAddLayerSheet}
                  >
                    <ActionSheetItem>{t('cancel')}</ActionSheetItem>
                  </div>
                </ActionSheetItemGroup>
              </div>
            </ActionSheet>
          </Portal>
        </div>
      </div>

      <div
        css={`
          display: flex;
        `}
      >
        {layerControl.activeLayer && (
          <div
            css={`
              display: flex;
              flex-flow: column;
              gap: 2px;
              width: 100%;
              margin-top: 4px;
              padding: 4px;
              border-top: 1px solid ${rgba('#000', 0.2)};

              > div {
                padding: 2px 0;
              }
            `}
          >
            <div
              css={`
                display: flex;
              `}
            >
              <FakeInput
                placeholder={`<${t(
                  `layerType.${layerControl.activeLayer.layerType}`
                )}>`}
                value={layerControl.activeLayer.name}
              />
              <div
                css={`
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin-left: 4px;
                `}
                onClick={handleClickRemoveLayer}
              >
                <DeleteBin
                  css={`
                    width: 16px;
                    padding-bottom: 2px;
                  `}
                />
              </div>
            </div>
            <div>
              <span css="margin-right: 8px;">{t('blend')}</span>

              <SelectBox
                items={[
                  { label: t('compositeModes.normal'), value: 'normal' },
                  { label: t('compositeModes.multiply'), value: 'multiply' },
                  { label: t('compositeModes.screen'), value: 'screen' },
                  { label: t('compositeModes.overlay'), value: 'overlay' },
                ]}
                value={layerControl.activeLayer.compositeMode}
                onChange={handleChangeCompositeMode}
              />
            </div>
            <div
              css={`
                display: flex;
                align-items: center;
              `}
            >
              <span>{t('opacity')}</span>
              <div
                css={`
                  flex: 1;
                `}
              >
                <input
                  css={`
                    width: 100%;
                    vertical-align: bottom;
                    background: linear-gradient(
                      to right,
                      ${rgba('#fff', 0)},
                      ${rgba('#fff', 1)}
                    );
                    ${rangeThumb}
                  `}
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={layerControl.activeLayer.opacity}
                  onChange={handleChangeOpacity}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const SortableLayerList = SortableContainer(
  ({ layers }: { layers: SilkEntity.LayerTypes[] }) => {
    const listRef = useRef<HTMLDivElement | null>(null)

    const [hasScroll, setHasScroll] = useState(false)

    useEffect(() => {
      const list = listRef.current
      if (!list) return
      setHasScroll(list.scrollHeight > list.clientHeight)
    })

    return (
      <div
        ref={listRef}
        css={`
          max-height: 40vh;
          overflow: auto;
          overflow-x: hidden;
          ${silkScroll}
        `}
        style={{
          maskImage: hasScroll
            ? `linear-gradient(to bottom, #000 96%, rgba(255, 255, 255, 0) 100%)`
            : 'none',
        }}
      >
        {layers.map((layer, idx) => (
          <SortableLayerItem key={layer.id} index={idx} layer={layer} />
        ))}
      </div>
    )
  }
)

const SortableLayerItem = SortableElement(
  ({ layer }: { layer: SilkEntity.LayerTypes }) => {
    const { t } = useTranslation('app')
    const theme = useTheme()
    const { executeOperation } = useFleurContext()
    const { activeLayer, thumbnailUrlOfLayer } = useStore((get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      thumbnailUrlOfLayer: EditorSelector.thumbnailUrlOfLayer(get),
    }))

    const [actionSheetOpened, setActionSheetOpen] = useToggle(false)
    const actionSheetRef = useRef<HTMLDivElement | null>(null)

    const handleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
      if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return
      executeOperation(editorOps.setActiveLayer, layer.id)
    })

    const handleClickToggleVisible = useFunk((e: MouseEvent) => {
      executeOperation(editorOps.updateLayer, layer.id, (layer) => {
        layer.visible = !layer.visible
      })
    })

    const handleClickLayerConfig = useFunk((e: MouseEvent) => {
      e.stopPropagation()
      setActionSheetOpen()
    })

    const handleSheetClose = useFunk(() => {
      setActionSheetOpen(false)
    })

    useClickAway(actionSheetRef, (e) => {
      if (isEventIgnoringTarget(e.target)) return
      setActionSheetOpen(false)
    })

    return (
      <div
        css={css`
          display: flex;
          gap: 8px;
          padding: 8px;
          height: 48px;
          user-select: none;
          color: ${({ theme }) => theme.exactColors.black40};
        `}
        style={
          {
            // backgroundColor:
            //   layerControl.activeLayer?.id === layer.id
            //     ? theme.surface.floatActive
            //     : 'transparent',
          }
        }
        onClick={handleClick}
      >
        <img
          css={`
            background: linear-gradient(
                45deg,
                rgba(0, 0, 0, 0.2) 25%,
                transparent 25%,
                transparent 75%,
                rgba(0, 0, 0, 0.2) 75%
              ),
              linear-gradient(
                45deg,
                rgba(0, 0, 0, 0.2) 25%,
                transparent 25%,
                transparent 75%,
                rgba(0, 0, 0, 0.2) 75%
              );
            background-size: 8px 8px;
            background-position: 0 0, 4px 4px;
            width: 32px;
            height: 32px;
          `}
          style={{
            border:
              activeLayer?.id === layer.id
                ? `2px solid ${theme.colors.blueFade40}`
                : '2px solid transparent',
          }}
          src={thumbnailUrlOfLayer(layer.id)}
        />
        <div
          css={`
            display: flex;
            justify-content: center;
          `}
          onClick={handleClickToggleVisible}
        >
          {layer.visible ? (
            <Eye
              css={`
                width: 20px;
              `}
            />
          ) : (
            <EyeClose
              css={`
                width: 20px;
              `}
            />
          )}
        </div>
        <div
          css={`
            display: flex;
            flex-flow: column;
            flex: 1;
            overflow: hidden;
          `}
        >
          <div
            css={`
              max-width: 100%;
              white-space: nowrap;
            `}
          >
            {layer.name === ''
              ? `<${t(`layerType.${layer.layerType}`)}>`
              : layer.name}
          </div>
          <div css="display: flex; gap: 4px;">
            <span>{t(`compositeModes.${layer.compositeMode}`)}</span>
            <span>{Math.round(layer.opacity)}%</span>
          </div>
        </div>

        <div
          css={`
            display: flex;
            justify-content: center;
            align-items: center;
          `}
          onClick={handleClickLayerConfig}
          data-ignore-click
        >
          {layer.filters.length > 0 ? (
            <MagicFill
              css={`
                width: 20px;
              `}
            />
          ) : (
            <Magic
              css={`
                width: 20px;
              `}
            />
          )}
        </div>

        <div
          css={`
            display: flex;
            justify-content: center;
            align-items: center;
          `}
          data-ignore-click
        >
          <LayerSortHandle />
        </div>

        <Portal>
          <ActionSheet
            ref={actionSheetRef}
            opened={actionSheetOpened}
            onClose={handleSheetClose}
            fill
          >
            <div
              css={`
                display: flex;
                flex-flow: column;
              `}
            >
              <div
                css={`
                  margin-bottom: 24px;
                `}
              >
                フィルター -{' '}
                <span
                  css={`
                    max-width: 100px;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                  `}
                >
                  {layer.name}
                </span>
              </div>

              <SortableFiltersList
                css={`
                  flex: 1;
                  overflow: auto;
                `}
                layer={layer}
                axis="y"
                useDragHandle
              />
            </div>
          </ActionSheet>
        </Portal>
      </div>
    )
  }
)

const LayerSortHandle = SortableHandle(() => (
  <span tabIndex={0}>
    <Menu
      css={`
        width: 20px;
      `}
    />
  </span>
))

const SortableFiltersList = SortableContainer(
  ({
    layer,
    className,
  }: {
    layer: SilkEntity.LayerTypes
    className?: string
  }) => {
    return (
      <ul className={className}>
        {layer.filters.map((filter, idx) => (
          <SortableFilterItem
            key={filter.id}
            index={idx}
            layer={layer}
            filter={filter}
          />
        ))}
      </ul>
    )
  }
)

const SortableFilterItem = SortableElement(
  ({
    layer,
    filter,
  }: {
    layer: SilkEntity.LayerTypes
    filter: SilkEntity.Filter
  }) => {
    const { t } = useTranslation('app')

    const { executeOperation } = useFleurContext()
    const { selectedFilterIds } = useStore((get) => ({
      selectedFilterIds: get(EditorStore).state.selectedFilterIds,
    }))
    const active = selectedFilterIds[filter.id]

    const handleClick = useFunk(
      (e: MouseEvent<HTMLDivElement>) => {
        if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return

        executeOperation(editorOps.setSelectedFilterIds, { [filter.id]: true })
      },
      [filter]
    )

    const handleToggleVisibility = useFunk(() => {
      if (!activeLayer) return

      executeOperation(editorOps.updateLayer, layer.id, (layer) => {
        const targetFilter = layer.filters.find((f) => f.id === filter.id)
        if (!targetFilter) return

        targetFilter.visible = !targetFilter.visible
      })

      executeOperation(editorOps.rerenderCanvas)
    }, [filter])

    return (
      <div
        css={`
          display: flex;
          flex-wrap: wrap;
          gap: 4px 16px;
          padding: 8px 0;
          padding-right: 8px;

          & + & {
            border-top: 1px solid ${rgba('#000', 0.1)};
          }
        `}
        onClick={handleClick}
      >
        <div
          css={`
            ${centering()}
          `}
          onClick={handleToggleVisibility}
          data-ignore-click
        >
          {filter.visible ? (
            <Eye
              css={`
                width: 20px;
                vertical-align: bottom;
              `}
            />
          ) : (
            <EyeClose
              css={`
                width: 20px;
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

        <div
          css={`
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: auto;
          `}
          data-ignore-click
        >
          <FilterSortHandle />
        </div>

        {active && (
          <div
            css={`
              flex-basis: 100%;
              padding-left: 24px;
            `}
          >
            <FilterSettings layer={layer} filter={filter}></FilterSettings>
          </div>
        )}
      </div>
    )
  }
)

const FilterSortHandle = SortableHandle(() => (
  <span>
    <Menu
      css={`
        width: 16px;
        vertical-align: bottom;
      `}
    />
  </span>
))
