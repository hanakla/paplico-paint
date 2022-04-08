import { ChangeEvent, MouseEvent, ReactNode, useEffect, useRef } from 'react'
import { SilkDOM, SilkHelper } from 'silk-core'
import { useClickAway, useToggle, useUpdate } from 'react-use'
import { loadImageFromBlob, selectFile, useFunk } from '@hanakla/arma'
import { rgba } from 'polished'
import { usePopper } from 'react-popper'
import { Add } from '@styled-icons/remix-fill'
import { css } from 'styled-components'
import { Portal } from '🙌/components/Portal'
import {
  SortableContainer,
  SortableElement,
  SortEndHandler,
} from 'react-sortable-hoc'
import { centering, rangeThumb, silkScroll } from '🙌/utils/mixins'
import { useTranslation } from 'next-i18next'
import { ArrowDownS, Stack } from '@styled-icons/remix-line'
import { Eye, EyeClose } from '@styled-icons/remix-fill'
import { useLayerControl } from '🙌/hooks/useLayers'
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuParam,
  useContextMenu,
} from '🙌/components/ContextMenu'
import { combineRef } from '🙌/utils/react'
import { SelectBox } from '🙌/components/SelectBox'

import { FakeInput } from '🙌/components/FakeInput'
import { DOMUtils } from '🙌/utils/dom'
import { useMouseTrap } from '🙌/hooks/useMouseTrap'
import { useTheme } from 'styled-components'
import { useFleurContext, useStore } from '@fleur/react'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { isEventIgnoringTarget } from '../helpers'
import { reversedIndex } from '🙌/utils/array'
import { SidebarPane } from '🙌/components/SidebarPane'
import { tm } from '🙌/utils/theme'

export function LayerView() {
  const { t } = useTranslation('app')
  const layerControls = useLayerControl()

  const { executeOperation } = useFleurContext()
  const { activeLayer, currentDocument, layers } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    layers: EditorSelector.layers(get),
    currentDocument: EditorSelector.currentDocument(get),
  }))

  const [layerTypeOpened, toggleLayerTypeOpened] = useToggle(false)
  const layerTypeOpenerRef = useRef<HTMLDivElement | null>(null)
  const layerTypeDropdownRef = useRef<HTMLUListElement | null>(null)

  useClickAway(layerTypeDropdownRef, (e) => {
    if (isEventIgnoringTarget(e.target)) return
    // Reduce rerendering
    if (layerTypeOpened) toggleLayerTypeOpened(false)
  })

  const layerTypePopper = usePopper(
    layerTypeOpenerRef.current,
    layerTypeDropdownRef.current,
    {
      placement: 'bottom-end',
      strategy: 'absolute',
    }
  )

  const handleClickAddLayerItem = useFunk(
    async ({ currentTarget }: MouseEvent<HTMLLIElement>) => {
      if (!currentDocument) return

      const layerType = currentTarget.dataset.layerType!
      const lastLayerId = activeLayer?.uid
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

      executeOperation(EditorOps.addLayer, layer, { aboveLayerId: lastLayerId })
      toggleLayerTypeOpened(false)
    }
  )

  const handleChangeFile = useFunk(
    async ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      const [file] = Array.from(currentTarget.files!)
      if (!file) return

      const lastLayerId = activeLayer?.uid
      const { image } = await loadImageFromBlob(file)
      const layer = await SilkHelper.imageToLayer(image)
      executeOperation(EditorOps.addLayer, layer, { aboveLayerId: lastLayerId })

      currentTarget.value = ''
    }
  )

  const handleLayerSortEnd: SortEndHandler = useFunk((sort) => {
    executeOperation(
      EditorOps.moveLayer,
      reversedIndex(layers, sort.oldIndex),
      reversedIndex(layers, sort.newIndex)
    )
    // layerControls.moveLayer(sort.oldIndex, sort.newIndex)
  })

  const handleChangeLayerName = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      executeOperation(
        EditorOps.updateLayer,
        activeLayer?.uid,
        (layer) => {
          layer.name = currentTarget.value
        },
        { skipRerender: false }
      )
    }
  )

  const handleChangeCompositeMode = useFunk((value: string) => {
    executeOperation(
      EditorOps.updateLayer,
      activeLayer?.uid,
      (layer) => (layer.compositeMode = value as any)
    )
  })

  const handleChangeOpacity = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayer) return

      executeOperation(EditorOps.updateLayer, activeLayer.uid, (layer) => {
        layer.opacity = currentTarget.valueAsNumber
      })
    }
  )

  const container = useFunk((children: ReactNode) => <div>{children}</div>)

  return (
    <SidebarPane
      heading={
        <>
          <Stack
            css={`
              width: 16px;
              margin-right: 4px;
            `}
          />
          レイヤー
        </>
      }
      container={container}
    >
      {activeLayer && (
        <div
          css={css`
            display: flex;
            flex-flow: column;
            gap: 8px;
            padding: 8px;
            padding-bottom: 14px;
            ${tm((o) => [o.border.default.bottom])}
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
                  display: block;
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

      {layers && (
        <>
          <div
            css={`
              margin-left: auto;
              padding: 4px;
            `}
          >
            <div
              css={`
                display: flex;
                justify-content: flex-end;
                user-select: none;
              `}
            >
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

          <SortableLayerList
            layers={[...layers].reverse()}
            onSortEnd={handleLayerSortEnd}
            distance={2}
            lockAxis={'y'}
          />
        </>
      )}
    </SidebarPane>
  )
}

type LayerContextMenuParam = ContextMenuParam<{ layerUid: string }>

const SortableLayerList = SortableContainer(
  ({ layers }: { layers: SilkDOM.LayerTypes[] }) => {
    const contextMenu = useContextMenu()
    const { executeOperation } = useFleurContext()

    const handleContextMenu = useFunk(
      (e: MouseEvent<HTMLDivElement>, layerUid: string) => {
        console.log(e, layerUid)
        contextMenu.show(e, { props: { layerUid } })
      }
    )

    const handleClickDeleteLayer = useFunk((e: LayerContextMenuParam) => {
      console.log(e)
      // executeOperation(EditorOps.deleteLayer, e.props!.layerUid)
    })

    return (
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
          <SortableLayerItem
            key={layer.uid}
            index={idx}
            layer={layer}
            onContextMenu={handleContextMenu}
          />
        ))}

        <ContextMenu id={contextMenu.id}>
          <ContextMenuItem onClick={handleClickDeleteLayer}>
            削除
          </ContextMenuItem>
        </ContextMenu>
      </div>
    )
  }
)

const SortableLayerItem = SortableElement(function LayerItem({
  layer,
  onContextMenu,
}: {
  layer: SilkDOM.LayerTypes
  onContextMenu: (e: MouseEvent<HTMLDivElement>, layerUid: string) => void
}) {
  const { t } = useTranslation('app')
  const theme = useTheme()
  const rerender = useUpdate()

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

  const handleToggleVisibility = useFunk(() => {
    executeOperation(
      EditorOps.updateLayer,
      layer.uid,
      (layer) => (layer.visible = !layer.visible)
    )
  })

  const handleChangeActiveLayer = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (
      DOMUtils.closestOrSelf(e.target, '[data-ignore-click]') ||
      DOMUtils.closestOrSelf(e.target, '[data-ignore-layer-click]')
    )
      return

    executeOperation(EditorOps.setActiveLayer, layer.uid)
  })

  const handleClickObject = useFunk(
    ({ currentTarget }: MouseEvent<HTMLDivElement>) => {
      executeOperation(
        EditorOps.setActiveObject,
        currentTarget.dataset.objectId ?? null,
        activeLayer?.uid
      )
    }
  )

  const handleClickDeleteObject = useFunk((_, data) => {
    if (layer.layerType !== 'vector') return

    const idx = layer.objects.findIndex((obj) => obj.uid === data.objectId)
    if (idx === -1) return

    layer.update((layer) => {
      layer.objects.splice(idx, 1)
    })
  })

  const handleChangeLayerName = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      executeOperation(EditorOps.updateLayer, layer.uid, (layer) => {
        layer.name = currentTarget.value
      })
    }
  )

  const handleContextMenu = useFunk((e: MouseEvent<HTMLDivElement>) => {
    onContextMenu(e, layer.uid)
  })

  useMouseTrap(
    rootRef,
    [
      {
        key: ['del', 'backspace'],
        handler: () => {
          executeOperation(EditorOps.deleteLayer, layer.uid)
        },
      },
    ],
    [layer]
  )

  useEffect(() => {
    // layer.on('updated', rerender)
    // return () => layer.off('updated', rerender)
  }, [layer.uid])

  return (
    <div
      ref={combineRef(rootRef)}
      css={`
        cursor: default;
      `}
      onClick={handleChangeActiveLayer}
      onContextMenu={handleContextMenu}
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
            activeLayer?.uid === layer.uid
              ? theme.surface.sidebarListActive
              : '',
          color:
            activeLayer?.uid === layer.uid ? theme.text.sidebarListActive : '',
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
            padding: 4px 0;
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
          src={thumbnailUrlOfLayer(layer.uid)}
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
              background: transparent;
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
              <>
                <div
                  css={`
                    padding: 6px 8px;
                    margin-left: 16px;
                  `}
                  style={{
                    backgroundColor:
                      activeObjectId == object.uid
                        ? theme.surface.sidebarListActive
                        : undefined,
                  }}
                  data-object-id={object.uid}
                  onClick={handleClickObject}
                  data-ignore-layer-click
                >
                  パス
                </div>

                {/* <ContextMenu>
                  <ContextMenuItem
                    data={{ objectId: object.uid }}
                    onClick={handleClickDeleteObject}
                  >
                    削除
                  </ContextMenuItem>
                </ContextMenu> */}
              </>
            ))}
          </div>
        </>
      )}
    </div>
  )
})
