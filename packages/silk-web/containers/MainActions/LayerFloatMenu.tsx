import { Add, DeleteBin, Eye, EyeClose, Menu } from '@styled-icons/remix-line'
import { useTranslation } from 'next-i18next'
import { rgba } from 'polished'
import {
  ChangeEvent,
  MouseEvent,
  useCallback,
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
import { useTheme } from 'styled-components'
import { SilkEntity } from 'silk-core'
import { Portal } from '../../components/Portal'
import { useLayerControl } from '../../hooks/useLayers'
import { rangeThumb, silkScroll } from '../../utils/mixins'
import { useSilkEngine } from '../../hooks/useSilkEngine'
import { useUpdate } from 'react-use'

export const LayerFloatMenu = () => {
  const { t } = useTranslation()
  const layerControl = useLayerControl()

  const rootRef = useRef<HTMLDivElement | null>(null)

  const handleChangeCompositeMode = useCallback(
    ({ currentTarget }: ChangeEvent<HTMLSelectElement>) => {
      layerControl.changeCompositeMode(
        layerControl.activeLayer?.id,
        currentTarget.value
      )
    },
    [layerControl]
  )

  const handleChangeOpacity = useCallback(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      layerControl.changeOpacity(
        layerControl.activeLayer?.id,
        currentTarget.valueAsNumber
      )
    },
    [layerControl]
  )

  const handleLayerSortEnd: SortEndHandler = useCallback(
    (sort) => {
      layerControl.moveLayer(sort.oldIndex, sort.newIndex)
    },
    [layerControl]
  )

  const handleClickAddLayer = useCallback(() => {
    const newLayer = SilkEntity.RasterLayer.create({
      width: 1000,
      height: 1000,
    })
    layerControl.addLayer(newLayer, {
      aboveLayerId: layerControl.activeLayer?.id,
    })
  }, [layerControl])

  return (
    <div
      css={`
        padding: 8px 4px;
      `}
    >
      <div>
        <SortableLayerList
          layers={layerControl.layers}
          onSortEnd={handleLayerSortEnd}
          distance={1}
          // hideSortableGhost
          useDragHandle
          // helperContainer={() => rootRef.current!}
        />
        <div
          css={`
            display: flex;
            align-items: center;
            justify-content: center;
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
              <input
                css={`
                  width: 100%;
                  margin-top: -2px;
                  padding: 2px;
                  appearance: none;
                  background-color: transparent;
                  border: none;
                  border-radius: 2px;
                  color: inherit;
                  outline: none;

                  &:focus,
                  &:active {
                    color: ${({ theme }) => theme.text.inputActive};
                    background-color: ${({ theme }) =>
                      theme.surface.inputActive};
                  }
                `}
                type="text"
                value={layerControl.activeLayer.id}
              />
              <div
                css={`
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin-left: 4px;
                `}
                onClick={handleClickAddLayer}
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
              {t('blend')}
              <select
                value={layerControl.activeLayer.compositeMode}
                onChange={handleChangeCompositeMode}
              >
                <option value="normal">{t('compositeModes.normal')}</option>
                <option value="multiply">{t('compositeModes.multiply')}</option>
                <option value="screen">{t('compositeModes.screen')}</option>
                <option value="overlay">{t('compositeModes.overlay')}</option>
              </select>
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
    const rerender = useUpdate()
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
    const { t } = useTranslation()
    const theme = useTheme()
    const layerControl = useLayerControl()

    const handleClick = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).matches('[data-ignore-click]')) return
        layerControl.setActiveLayer(layer.id)
      },
      [layerControl, layer]
    )

    const handleClickToggleVisible = useCallback(
      (e: MouseEvent) => {
        e.stopPropagation()
        layerControl.toggleVisibility(layer.id)
      },
      [layerControl, layer]
    )

    return (
      <div
        css={`
          display: flex;
          gap: 8px;
          padding: 8px;
          user-select: none;
          color: ${({ theme }) => theme.text.mainActionsBlack};
        `}
        style={{
          backgroundColor:
            layerControl.activeLayer?.id === layer.id
              ? theme.surface.floatActive
              : 'transparent',
        }}
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
              layerControl.activeLayer?.id === layer.id
                ? `2px solid ${theme.border.floatActiveLayer}`
                : '2px solid transparent',
          }}
          src={layerControl?.getPreview(layer.id)}
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
                width: 16px;
              `}
            />
          ) : (
            <EyeClose
              css={`
                width: 16px;
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
            {layer.id}
          </div>
          <div css="display: flex; gap: 4px; margin-top: 4px;">
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
          data-ignore-click
        >
          <LayerSortHandle />
        </div>
      </div>
    )
  }
)

const LayerSortHandle = SortableHandle(() => (
  <span tabIndex={0}>
    <Menu
      css={`
        width: 16px;
      `}
    />
  </span>
))
