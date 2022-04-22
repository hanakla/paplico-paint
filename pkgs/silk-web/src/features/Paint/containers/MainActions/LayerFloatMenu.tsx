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
import {
  ChangeEvent,
  forwardRef,
  memo,
  MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
  SortEndHandler,
} from 'react-sortable-hoc'
import { css, useTheme } from 'styled-components'
import { SilkDOM } from 'silk-core'
import { useFleurContext, useStore } from '@fleur/react'
import { useFunk } from '@hanakla/arma'

import { Portal } from '🙌/components/Portal'
import { useLayerControl } from '🙌/hooks/useLayers'
import { centering, rangeThumb, silkScroll } from '🙌/utils/mixins'
import { useClickAway, useToggle } from 'react-use'
import { SelectBox } from '🙌/components/SelectBox'
import { FakeInput } from '🙌/components/FakeInput'
import {
  ActionSheet,
  ActionSheetItem,
  ActionSheetItemGroup,
} from '🙌/components/ActionSheet'
import { FilterSettings } from '../FilterSettings'
import { DOMUtils } from '🙌/utils/dom'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { reversedIndex } from '🙌/utils/array'
import { closestCenter, DndContext, DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { calcLayerMove, FlatLayerEntry, flattenLayers } from '../../helpers'
import { CSS } from '@dnd-kit/utilities'
import { useFleur } from '🙌/utils/hooks'
import { Checkbox } from '🙌/components/Checkbox'

export const LayerFloatMenu = memo(
  forwardRef<HTMLDivElement, {}>((_, ref) => {
    const { t } = useTranslation('app')

    const { execute } = useFleur()
    const { currentDocument, layers, activeLayer } = useStore((get) => ({
      currentDocument: EditorSelector.currentDocument(get),
      layers: EditorSelector.layers(get),
      activeLayer: EditorSelector.activeLayer(get),
    }))

    const [addLayerSheetOpened, toggleAddLayerSheetOpened] = useToggle(false)

    const handleChangeCompositeMode = useFunk((mode: string) => {
      if (!activeLayer) return

      execute(EditorOps.updateLayer, [activeLayer.uid], (layer) => {
        layer.compositeMode = mode as any
      })
    })

    const handleChangeOpacity = useFunk(
      ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
        if (!activeLayer) return

        execute(EditorOps.updateLayer, [activeLayer.uid], (layer) => {
          layer.opacity = currentTarget.valueAsNumber
        })
      }
    )

    const handleLayerDragEnd = useFunk(({ active, over }: DragEndEvent) => {
      const moves = calcLayerMove(flatLayers, { active, over })
      if (!moves) return

      execute(
        EditorOps.moveLayer,
        moves.sourcePath,
        moves.oldIndex,
        moves.newIndex
      )
    })

    const handleClickAddLayer = useFunk(() => {
      toggleAddLayerSheetOpened(true)
    })

    const handleClickAddLayerItem = useFunk(
      ({ currentTarget }: MouseEvent<HTMLDivElement>) => {
        if (!currentDocument) return

        const layerType = currentTarget.dataset
          .layerType! as SilkDOM.LayerTypes['layerType']
        const { width, height } = currentDocument

        let layer: SilkDOM.LayerTypes
        switch (layerType) {
          case 'raster': {
            layer = SilkDOM.RasterLayer.create({ width, height })
            break
          }
          case 'vector': {
            layer = SilkDOM.VectorLayer.create({})
            break
          }
          case 'filter': {
            layer = SilkDOM.FilterLayer.create({})
            break
          }
          default:
            throw new Error('なんかおかしなっとるで')
        }

        execute(EditorOps.addLayer, layer, {
          aboveLayerId: activeLayer?.uid ?? null,
        })
        toggleAddLayerSheetOpened(false)
      }
    )

    const handleClickRemoveLayer = useFunk(() => {
      if (!activeLayer) return

      execute(EditorOps.deleteLayer, [activeLayer.uid])
    })

    const addLayerSheetRef = useRef<HTMLDivElement | null>(null)
    const handleCloseAddLayerSheet = useFunk(() => {
      toggleAddLayerSheetOpened(false)
    })

    useClickAway(addLayerSheetRef, (e) => {
      // Reduce rerendering
      if (addLayerSheetOpened) toggleAddLayerSheetOpened(false)
    })

    const flatLayers = flattenLayers(layers)

    return (
      <div
        ref={ref}
        css={css`
          padding: 8px 4px;
          color: ${({ theme }) => theme.exactColors.black10};
        `}
      >
        <div
          css={`
            display: grid;
            gap: 4px;
            max-height: 50vh;
            overflow: auto;
          `}
        >
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleLayerDragEnd}
          >
            <SortableContext
              items={flatLayers.map((l) => l.layer.uid)}
              strategy={verticalListSortingStrategy}
            >
              {flatLayers.map((layer) => (
                <SortableLayerItem key={layer.layer.uid} layer={layer} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div
          css={`
            padding: 4px 0;
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
                <div onClick={handleClickAddLayerItem} data-layer-type="raster">
                  <ActionSheetItem>{t('layerType.raster')}</ActionSheetItem>
                </div>
                <div onClick={handleClickAddLayerItem} data-layer-type="vector">
                  <ActionSheetItem>{t('layerType.vector')}</ActionSheetItem>
                </div>
                <div onClick={handleClickAddLayerItem} data-layer-type="filter">
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

        <div
          css={`
            display: flex;
          `}
        >
          {activeLayer && (
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
                  placeholder={`<${t(`layerType.${activeLayer.layerType}`)}>`}
                  value={activeLayer.name}
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
                  value={activeLayer.compositeMode}
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
                    value={activeLayer.opacity}
                    onChange={handleChangeOpacity}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  })
)

const SortableLayerItem = ({
  layer: { layer, path, depth },
}: {
  layer: FlatLayerEntry
}) => {
  const { t } = useTranslation('app')
  const theme = useTheme()
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: layer.uid })

  const { execute } = useFleur()
  const { activeLayer, thumbnailUrlOfLayer, selectedLayerUids } = useStore(
    (get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      thumbnailUrlOfLayer: EditorSelector.thumbnailUrlOfLayer(get),
      selectedLayerUids: EditorSelector.selectedLayerUids(get),
    })
  )

  const [actionSheetOpened, setActionSheetOpen] = useToggle(false)
  const actionSheetRef = useRef<HTMLDivElement | null>(null)

  const handleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (DOMUtils.closestOrSelf(e.target, '[data-sortable-layer-ignore-click]'))
      return

    execute(EditorOps.setActiveLayer, [...path, layer.uid])
  })

  const handleClickToggleVisible = useFunk((e: MouseEvent) => {
    execute(EditorOps.updateLayer, [...path, layer.uid], (layer) => {
      layer.visible = !layer.visible
    })
  })

  const handleClickLayerConfig = useFunk((e: MouseEvent) => {
    e.stopPropagation()
    setActionSheetOpen()
  })

  const handleClickLayerCheck = useFunk((e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()

    execute(EditorOps.setLayerSelection, (uids) => {
      if (e.currentTarget.checked) {
        return [...uids, layer.uid]
      } else {
        return uids.filter((uid) => uid !== layer.uid)
      }
    })
  })

  const handleSheetClose = useFunk(() => {
    setActionSheetOpen(false)
  })

  useClickAway(actionSheetRef, (e) => {
    // Reduce rerendering
    if (actionSheetOpened) setActionSheetOpen(false)
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      css={css`
        display: flex;
        gap: 8px;
        padding: 4px 8px;
        user-select: none;
        color: ${({ theme }) => theme.exactColors.black40};
      `}
      style={{
        backgroundColor:
          activeLayer?.uid === layer.uid
            ? theme.colors.blueFade40
            : 'transparent',
        paddingLeft: 8 + depth * 24,
        ...style,
      }}
      onClick={handleClick}
    >
      <Checkbox
        checked={selectedLayerUids.includes(layer.uid)}
        onClick={DOMUtils.stopPropagationHandler}
        onChange={handleClickLayerCheck}
      />
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
        style={{}}
        src={thumbnailUrlOfLayer(layer.uid)}
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
        data-sortable-layer-ignore-click
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
        data-sortable-layer-ignore-click
        {...attributes}
        {...listeners}
      >
        <span tabIndex={0}>
          <Menu
            css={`
              width: 20px;
            `}
          />
        </span>
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

const SortableFiltersList = SortableContainer(
  ({ layer, className }: { layer: SilkDOM.LayerTypes; className?: string }) => {
    return (
      <ul className={className}>
        {layer.filters.map((filter, idx) => (
          <SortableFilterItem
            key={filter.uid}
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
    layer: SilkDOM.LayerTypes
    filter: SilkDOM.Filter
  }) => {
    const { t } = useTranslation('app')

    const { execute } = useFleur()
    const { selectedFilterIds } = useStore((get) => ({
      selectedFilterIds: get(EditorStore).state.selectedFilterIds,
    }))
    const active = selectedFilterIds[filter.uid]

    const handleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
      if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return

      execute(EditorOps.setSelectedFilterIds, { [filter.uid]: true })
    })

    const handleToggleVisibility = useFunk(() => {
      execute(EditorOps.updateLayer, [layer.uid], (layer) => {
        const targetFilter = layer.filters.find((f) => f.uid === filter.uid)
        if (!targetFilter) return

        targetFilter.visible = !targetFilter.visible
      })

      execute(EditorOps.rerenderCanvas)
    })

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
