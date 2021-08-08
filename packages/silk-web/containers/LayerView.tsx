import {
  ChangeEvent,
  MouseEvent,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import { SilkEntity, SilkHelper } from 'silk-core'
import { useClickAway, useToggle, useUpdate } from 'react-use'
import { rgba } from 'polished'
import { usePopper } from 'react-popper'
import { Portal } from '../components/Portal'
import {
  arrayMove,
  SortableContainer,
  SortableElement,
  SortEndHandler,
} from 'react-sortable-hoc'
import { rangeThumb, silkScroll } from '../utils/mixins'
import { useSilkEngine } from '../hooks/useSilkEngine'
import { useTranslation } from 'next-i18next'
import { ArrowDown, ArrowDownS, Stack } from '@styled-icons/remix-line'
import { useLayerControl } from '../hooks/useLayers'
import {
  ContextMenu,
  ContextMenuArea,
  ContextMenuItem,
} from '../components/ContextMenu'
import { combineRef } from '../utils/react'
import { useLysSlice } from '@fleur/lys'
import { EditorSlice } from '../domains/Editor'
import { SelectBox } from '../components/SelectBox'

export function LayerView() {
  const { t } = useTranslation('common')
  const layerControls = useLayerControl()

  const [layerTypeOpened, toggleLayerTypeOpened] = useReducer(
    (s, ns) => (ns != null ? ns : !s),
    false
  )
  const layerTypeOpenerRef = useRef<HTMLDivElement | null>(null)
  const layerTypeDropdownRef = useRef<HTMLUListElement | null>(null)
  useClickAway(layerTypeDropdownRef, () => toggleLayerTypeOpened(false))

  const popper = usePopper(
    layerTypeOpenerRef.current,
    layerTypeDropdownRef.current,
    {
      placement: 'bottom-end',
      strategy: 'fixed',
    }
  )

  const handleAddLayer = useCallback(() => {
    const newLayer = SilkEntity.RasterLayer.create({
      width: 1000,
      height: 1000,
    })
    layerControls.addLayer(newLayer, {
      aboveLayerId: layerControls.activeLayer?.id,
    })
  }, [layerControls])

  const handleLayerSortEnd: SortEndHandler = useCallback(
    (sort) => {
      layerControls.moveLayer(sort.oldIndex, sort.newIndex)
    },
    [layerControls]
  )

  const handleChangeCompositeMode = useCallback(
    (value: string) => {
      layerControls.changeCompositeMode(layerControls.activeLayer?.id, value)
    },
    [layerControls]
  )

  const handleChangeOpacity = useCallback(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      layerControls.changeOpacity(
        layerControls.activeLayer?.id,
        currentTarget.valueAsNumber
      )
    },
    [layerControls]
  )

  return (
    <div
      css={`
        display: flex;
        flex-flow: column;
        height: 40vh;
        overflow: auto;
        font-size: 12px;
        ${silkScroll}
      `}
    >
      <div
        css={`
          display: flex;
          padding: 4px;
          height: 24px;
          position: sticky;
          top: 0;
          background-color: #464b4e;
        `}
      >
        <Stack css="width: 16px;" />
        <div css="margin-left: auto">
          <div css="display:flex; user-select: none;">
            <div onClick={handleAddLayer}>＋</div>
            <div onClick={toggleLayerTypeOpened} ref={layerTypeOpenerRef}>
              ⇣
            </div>
          </div>

          <Portal>
            <ul
              css={`
                background-color: #464b4e;
                box-shadow: 0 0 4px ${rgba('#000', 0.5)};
                color: ${({ theme }) => theme.text.white};
                li {
                  padding: 8px;
                  user-select: none;
                }
                li:hover {
                  background-color: rgba(255, 255, 255, 0.2);
                }
              `}
              ref={layerTypeDropdownRef}
              style={{
                ...popper.styles.popper,
                ...(layerTypeOpened
                  ? { opacity: 1, pointerEvents: 'all' }
                  : { opacity: 0, pointerEvents: 'none' }),
              }}
              {...popper.attributes.popper}
            >
              <li>ベクターレイヤー</li>
              <li>調整レイヤー</li>
            </ul>
          </Portal>
        </div>
      </div>

      {layerControls.activeLayer && (
        <div
          css={`
            display: flex;
            flex-flow: column;
            gap: 2px;
            margin-top: 4px;
            padding: 8px 4px;
            border-top: 1px solid ${rgba('#000', 0.2)};
            border-bottom: 1px solid ${rgba('#000', 0.2)};

            > div {
              padding: 2px 0;
            }
          `}
        >
          <div>
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
                  background-color: ${({ theme }) => theme.surface.inputActive};
                }
              `}
              type="text"
              value={layerControls.activeLayer.id}
            />
          </div>
          <div>
            <span
              css={`
                margin-right: 8px;
              `}
            >
              {t('blend')}
            </span>

            <SelectBox
              css={`
                padding: 0px 4px;
              `}
              items={[
                { value: 'normal', label: t('compositeModes.normal') },
                { value: 'multiply', label: t('compositeModes.multiply') },
                { value: 'screen', label: t('compositeModes.screen') },
                { value: 'overlay', label: t('compositeModes.overlay') },
              ]}
              value={layerControls.activeLayer.compositeMode}
              onChange={handleChangeCompositeMode}
              placement="auto-start"
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
                value={layerControls.activeLayer.opacity}
                onChange={handleChangeOpacity}
              />
            </div>
          </div>
        </div>
      )}

      {layerControls.layers && (
        <SortableLayerList
          layers={layerControls.layers}
          distance={2}
          onSortEnd={handleLayerSortEnd}
        />
      )}
    </div>
  )
}

const SortableLayerItem = SortableElement(
  ({ layer }: { layer: SilkEntity.LayerTypes }) => {
    return <LayerItem layer={layer} />
  }
)

const SortableLayerList = SortableContainer(
  ({ layers }: { layers: SilkEntity.LayerTypes[] }) => (
    <div
      css={`
        flex: 1;
        background-color: ${({ theme }) => theme.surface.sidebarList};
      `}
    >
      {layers.map((layer, idx) => (
        <SortableLayerItem key={layer.id} index={idx} layer={layer} />
      ))}
    </div>
  )
)

function LayerItem({ layer }: { layer: SilkEntity.LayerTypes }) {
  const [editorState, editorActions] = useLysSlice(EditorSlice)
  const layerControls = useLayerControl()

  const [objectsOpened, toggleObjectsOpened] = useToggle(false)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const handleToggleVisibility = useCallback(() => {
    layerControls.toggleVisibility(layer.id)
  }, [layer, layerControls])

  const handleChangeActiveLayer = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).matches('[data-ignore-click]')) return
      layerControls.setActiveLayer(layer.id)
    },
    [layer, layerControls]
  )

  const handleClickObject = useCallback(
    ({ currentTarget }: MouseEvent<HTMLDivElement>) => {
      editorActions.setActiveObject(currentTarget.dataset.objectId ?? null)
    },
    []
  )

  const handleClickDeleteObject = useCallback((_, data) => {
    if (layer.layerType !== 'vector') return

    const idx = layer.objects.findIndex((obj) => obj.id === data.objectId)
    if (idx === -1) return

    layer.update((layer) => {
      layer.objects.splice(idx, 1)
    })
  }, [])

  return (
    <ContextMenuArea>
      {(ref) => (
        <div
          ref={combineRef(rootRef, ref)}
          css={`
            cursor: default;
          `}
          onClick={handleChangeActiveLayer}
        >
          <div
            css={`
              display: flex;
              width: 100%;
              padding: 4px;
              align-items: center;
            `}
            style={{
              backgroundColor:
                layerControls.activeLayer?.id === layer.id
                  ? `rgba(255,255,255,.2)`
                  : '',
            }}
          >
            <div
              css={`
                flex: none;
                width: 12px;
                margin-right: 4px;
              `}
            >
              {layer.layerType === 'vector' && (
                <ArrowDownS
                  css={`
                    width: 12px;
                  `}
                  style={{
                    transform: objectsOpened ? 'rotateZ(180deg)' : 'rotateZ(0)',
                  }}
                  onClick={toggleObjectsOpened}
                />
              )}
            </div>
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
                /* background-color: transparent; */
                background-size: 4px 4px;
                background-position: 0 0, 2px 2px;
                width: 16px;
                height: 16px;
                flex: none;
              `}
              src={layerControls.getPreview(layer.id)}
            />
            <div
              css={`
                margin-left: 8px;
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow-x: hidden;
                overflow-y: auto;
                ::-webkit-scrollbar {
                  display: none;
                }
              `}
            >
              {layer.id}
            </div>
            <div
              css={`
                ${layer.visible ? '' : 'opacity: .5;'}
              `}
              onClick={handleToggleVisibility}
              data-ignore-click
            >
              👀
            </div>
          </div>
          {layer.layerType === 'vector' && (
            <>
              <div
                css={`
                  flex-basis: 100%;
                  overflow: hidden;
                `}
                style={{
                  height: objectsOpened ? 'auto' : 0,
                }}
              >
                {layer.objects.map((object) => (
                  <ContextMenuArea>
                    {(ref) => (
                      <>
                        <div
                          ref={ref}
                          css={`
                            padding: 6px 8px;
                            margin-left: 24px;
                          `}
                          style={{
                            backgroundColor:
                              editorState.activeObjectId == object.id
                                ? `rgba(255,255,255,.2)`
                                : '',
                          }}
                          data-object-id={object.id}
                          onClick={handleClickObject}
                        >
                          パス
                        </div>

                        <ContextMenu>
                          <ContextMenuItem
                            data={{ objectId: object.id }}
                            onClick={handleClickDeleteObject}
                          >
                            削除
                          </ContextMenuItem>
                        </ContextMenu>
                      </>
                    )}
                  </ContextMenuArea>
                ))}
              </div>
            </>
          )}

          <ContextMenu>
            <ContextMenuItem>削除</ContextMenuItem>
          </ContextMenu>
        </div>
      )}
    </ContextMenuArea>
  )
}
