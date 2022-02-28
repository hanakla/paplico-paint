import { ChangeEvent, MouseEvent, useCallback, useRef } from 'react'
import { SilkEntity, SilkHelper } from 'silk-core'
import { useClickAway, useToggle } from 'react-use'
import { loadImageFromBlob, selectFile } from '@hanakla/arma'
import { rgba } from 'polished'
import { usePopper } from 'react-popper'
import { Add } from '@styled-icons/remix-fill'
import { css } from 'styled-components'
import { Portal } from '../components/Portal'
import {
  SortableContainer,
  SortableElement,
  SortEndHandler,
} from 'react-sortable-hoc'
import { centering, rangeThumb, silkScroll } from '../utils/mixins'
import { useTranslation } from 'next-i18next'
import { ArrowDownS, Stack } from '@styled-icons/remix-line'
import { Eye, EyeClose } from '@styled-icons/remix-fill'
import { useLayerControl } from '../hooks/useLayers'
import {
  ContextMenu,
  ContextMenuArea,
  ContextMenuItem,
} from '../components/ContextMenu'
import { combineRef } from '../utils/react'
import { SelectBox } from '../components/SelectBox'

import { FakeInput } from '../components/FakeInput'
import { DOMUtils } from '../utils/dom'
import { useMouseTrap } from '../hooks/useMouseTrap'
import { useTheme } from 'styled-components'
import { useFleurContext, useStore } from '@fleur/react'
import { editorOps, EditorSelector, EditorStore } from '../domains/EditorStable'

export function LayerView() {
  const { t } = useTranslation('app')
  const theme = useTheme()
  const layerControls = useLayerControl()

  const { executeOperation } = useFleurContext()
  const { activeLayer, currentDocument } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    currentDocument: EditorSelector.currentDocument(get),
  }))

  const [layerTypeOpened, toggleLayerTypeOpened] = useToggle(false)
  const layerTypeOpenerRef = useRef<HTMLDivElement | null>(null)
  const layerTypeDropdownRef = useRef<HTMLUListElement | null>(null)
  useClickAway(layerTypeDropdownRef, () => toggleLayerTypeOpened(false))

  const layerTypePopper = usePopper(
    layerTypeOpenerRef.current,
    layerTypeDropdownRef.current,
    {
      placement: 'bottom-end',
      strategy: 'absolute',
    }
  )

  const handleClickAddLayerItem = useCallback(
    async ({ currentTarget }: MouseEvent<HTMLLIElement>) => {
      if (!currentDocument) return

      const layerType = currentTarget.dataset.layerType!
      const lastLayerId = activeLayer?.id
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
        case 'image': {
          const [file] = await selectFile({
            extensions: ['.jpg', '.jpeg', '.png'],
          })
          if (!file) return

          const { image } = await loadImageFromBlob(file)
          layer = await SilkHelper.imageToLayer(image)
          break
        }
        default:
          throw new Error('なんかおかしなっとるで')
      }

      executeOperation(editorOps.addLayer, layer, { aboveLayerId: lastLayerId })
      toggleLayerTypeOpened(false)
    },
    [currentDocument, activeLayer]
  )

  const handleChangeFile = useCallback(
    async ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      const [file] = Array.from(currentTarget.files!)
      if (!file) return

      const lastLayerId = activeLayer?.id
      const { image } = await loadImageFromBlob(file)
      const layer = await SilkHelper.imageToLayer(image)
      executeOperation(editorOps.addLayer, layer, { aboveLayerId: lastLayerId })

      currentTarget.value = ''
    },
    [activeLayer]
  )

  const handleLayerSortEnd: SortEndHandler = useCallback(
    (sort) => {
      layerControls.moveLayer(sort.oldIndex, sort.newIndex)
    },
    [layerControls]
  )

  const handleChangeLayerName = useCallback(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      executeOperation(
        editorOps.updateLayer,
        activeLayer?.id,
        (layer) => {
          layer.name = currentTarget.value
        },
        { skipRerender: false }
      )
    },
    [activeLayer]
  )

  const handleChangeCompositeMode = useCallback(
    (value: string) => {
      executeOperation(
        editorOps.updateLayer,
        activeLayer?.id,
        (layer) => (layer.compositeMode = value as any)
      )
    },
    [activeLayer]
  )

  const handleChangeOpacity = useCallback(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayer) return

      executeOperation(editorOps.updateLayer, activeLayer.id, (layer) => {
        layer.opacity = currentTarget.valueAsNumber
      })
    },
    [activeLayer]
  )

  return (
    <div
      css={`
        display: flex;
        flex-flow: column;
        font-size: 12px;
      `}
    >
      <header
        css={`
          display: flex;
          padding: 6px;
          position: sticky;
          top: 0;
        `}
      >
        <Stack css="width: 16px;" />
        <div css="margin-left: auto">
          <div css="display:flex; user-select: none;">
            <div ref={layerTypeOpenerRef} onClick={toggleLayerTypeOpened}>
              <Add css="width: 16px;" />
            </div>
          </div>

          <Portal>
            <ul
              ref={layerTypeDropdownRef}
              css={css`
                background-color: ${({ theme }) => theme.surface.popupMenu};
                box-shadow: 0 0 4px ${rgba('#000', 0.5)};
                color: ${({ theme }) => theme.text.white};
                z-index: 1;

                li {
                  padding: 8px;
                  user-select: none;
                }
                li:hover {
                  background-color: rgba(255, 255, 255, 0.2);
                }
              `}
              style={{
                ...layerTypePopper.styles.popper,
                ...(layerTypeOpened
                  ? { visibility: 'visible', pointerEvents: 'all' }
                  : { visibility: 'hidden', pointerEvents: 'none' }),
              }}
              {...layerTypePopper.attributes.popper}
            >
              <li data-layer-type="raster" onClick={handleClickAddLayerItem}>
                {t('layerType.raster')}
              </li>
              <li data-layer-type="vector" onClick={handleClickAddLayerItem}>
                {t('layerType.vector')}
              </li>
              <li data-layer-type="filter" onClick={handleClickAddLayerItem}>
                {t('layerType.filter')}
              </li>
              <li data-layer-type="image" onClick={handleClickAddLayerItem}>
                <label>
                  {t('addFromImage')}
                  <input
                    css={`
                      display: block;
                      width: 1px;
                      height: 1px;
                      opacity: 0;
                    `}
                    type="file"
                    accept="'.png,.jpeg,.jpg"
                    onChange={handleChangeFile}
                  />
                </label>
              </li>
            </ul>
          </Portal>
        </div>
      </header>

      {activeLayer && (
        <div
          css={css`
            display: flex;
            flex-flow: column;
            gap: 8px;
            margin-top: 4px;
            padding: 8px;
            padding-bottom: 14px;
            border-top: 1px solid
              ${({ theme }) => theme.exactColors.blackFade30};
            border-bottom: 1px solid
              ${({ theme }) => theme.exactColors.blackFade30};
          `}
        >
          <div>
            <FakeInput
              value={activeLayer.name}
              placeholder={`<${t(`layerType.${activeLayer.layerType}`)}>`}
              onChange={handleChangeLayerName}
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
                padding: 2px 4px;
              `}
              items={[
                { value: 'normal', label: t('compositeModes.normal') },
                { value: 'multiply', label: t('compositeModes.multiply') },
                { value: 'screen', label: t('compositeModes.screen') },
                { value: 'overlay', label: t('compositeModes.overlay') },
              ]}
              value={activeLayer.compositeMode}
              onChange={handleChangeCompositeMode}
              placement="bottom-start"
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

      {currentDocument?.layers && (
        <SortableLayerList
          layers={[...currentDocument.layers].reverse()}
          onSortEnd={handleLayerSortEnd}
          distance={2}
          lockAxis={'y'}
        />
      )}
    </div>
  )
}

const SortableLayerItem = SortableElement(function LayerItem({
  layer,
}: {
  layer: SilkEntity.LayerTypes
}) {
  const { t } = useTranslation('app')
  const theme = useTheme()

  const { executeOperation } = useFleurContext()
  const { activeLayer, currentDocument, thumbnailUrlOfLayer, activeObjectId } =
    useStore((get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      currentDocument: EditorSelector.currentDocument(get),
      thumbnailUrlOfLayer: EditorSelector.thumbnailUrlOfLayer(get),
      activeObjectId: get(EditorStore).state.activeObjectId,
    }))

  const [objectsOpened, toggleObjectsOpened] = useToggle(false)

  const rootRef = useRef<HTMLDivElement | null>(null)

  const handleToggleVisibility = useCallback(() => {
    executeOperation(
      editorOps.updateLayer,
      layer.id,
      (layer) => (layer.visible = !layer.visible)
    )
  }, [layer])

  const handleChangeActiveLayer = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return
      executeOperation(editorOps.setActiveLayer, layer.id)
    },
    [layer]
  )

  const handleClickObject = useCallback(
    ({ currentTarget }: MouseEvent<HTMLDivElement>) => {
      executeOperation(
        editorOps.setActiveObject,
        currentTarget.dataset.objectId ?? null
      )
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

  const handleChangeLayerName = useCallback(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      executeOperation(editorOps.updateLayer, layer.id, (layer) => {
        layer.name = currentTarget.value
      })
    },
    [layer]
  )

  useMouseTrap(
    rootRef,
    [
      {
        key: ['del', 'backspace'],
        handler: () => {
          executeOperation(editorOps.deleteLayer, layer.id)
        },
      },
    ],
    [layer]
  )

  return (
    <ContextMenuArea>
      {(ref) => (
        <div
          ref={combineRef(rootRef, ref)}
          css={`
            cursor: default;
          `}
          onClick={handleChangeActiveLayer}
          tabIndex={-1}
        >
          <div
            css={`
              display: flex;
              gap: 4px;
              width: 100%;
              padding: 4px;
              align-items: center;
            `}
            style={{
              backgroundColor:
                activeLayer?.id === layer.id
                  ? theme.surface.sidebarListActive
                  : '',
              color:
                activeLayer?.id === layer.id
                  ? theme.text.sidebarListActive
                  : '',
            }}
          >
            <div
              css={`
                flex: none;
                width: 12px;
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

            <div
              css={css`
                padding: 4px;
                color: ${({ theme }) => theme.colors.white10};
              `}
              style={{
                ...(layer.visible ? {} : { opacity: 0.5 }),
              }}
              onClick={handleToggleVisibility}
              data-ignore-click
            >
              {layer.visible ? (
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
              src={thumbnailUrlOfLayer(layer.id)}
            />
            <div
              css={`
                ${centering({ x: false, y: true })}
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow-x: hidden;
                overflow-y: auto;
                ::-webkit-scrollbar {
                  display: none;
                }
              `}
            >
              <FakeInput
                css={`
                  font-size: 12px;
                  pointer-events: none;
                  &::placeholder {
                    color: #9e9e9e;
                  }
                `}
                value={layer.name}
                placeholder={`<${t(`layerType.${layer.layerType}`)}>`}
                onChange={handleChangeLayerName}
                disabled
              />
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
                            margin-left: 16px;
                          `}
                          style={{
                            backgroundColor:
                              activeObjectId == object.id
                                ? theme.surface.sidebarListActive
                                : undefined,
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
})

const SortableLayerList = SortableContainer(
  ({ layers }: { layers: SilkEntity.LayerTypes[] }) => (
    <div
      css={css`
        min-height: 40vh;
        max-height: 40vh;
        flex: 1;
        overflow: auto;
        background-color: ${({ theme }) => theme.colors.black50};
        ${silkScroll}
      `}
    >
      {layers.map((layer, idx) => (
        <SortableLayerItem key={layer.id} index={idx} layer={layer} />
      ))}
    </div>
  )
)