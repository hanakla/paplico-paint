import {
  ChangeEvent,
  FC,
  MouseEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { SilkCommands, SilkDOM, SilkHelper } from 'silk-core'
import { useClickAway, useToggle, useUpdate } from 'react-use'
import { loadImageFromBlob, selectFile, useFunk } from '@hanakla/arma'
import { rgba } from 'polished'
import { usePopper } from 'react-popper'
import { Add, Brush, Filter3 } from '@styled-icons/remix-fill'
import { css } from 'styled-components'
import { Portal } from '🙌/components/Portal'
import {
  SortableContainer,
  SortableElement,
  SortEndHandler,
} from 'react-sortable-hoc'
import { centering, rangeThumb, silkScroll } from '🙌/utils/mixins'
import { useTranslation } from 'next-i18next'
import { ArrowDownS, Guide, Stack, Text } from '@styled-icons/remix-line'
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
import { calcLayerMove, flattenLayers, isEventIgnoringTarget } from '../helpers'
import { reversedIndex } from '🙌/utils/array'
import { SidebarPane } from '🙌/components/SidebarPane'
import { tm } from '🙌/utils/theme'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PropsOf } from '🙌/utils/types'
import { contextMenu } from 'react-contexify'
import { Tooltip2 } from '🙌/components/Tooltip2'
import { useCachedInputState, useDebouncedFunk } from '🙌/utils/hooks'

export function LayerView() {
  const { t } = useTranslation('app')

  const { executeOperation } = useFleurContext()
  const { activeLayer, activeLayerPath, currentDocument, layers } = useStore(
    (get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      activeLayerPath: EditorSelector.activeLayerPath(get),
      layers: EditorSelector.layers(get),
      currentDocument: EditorSelector.currentDocument(get),
    })
  )

  const [layerTypeOpened, toggleLayerTypeOpened] = useToggle(false)
  const layerTypeOpenerRef = useRef<HTMLDivElement | null>(null)
  const layerTypeDropdownRef = useRef<HTMLUListElement | null>(null)

  const [layerName, setLayerName] = useCachedInputState(activeLayer?.name)

  const contextMenu = useContextMenu('LAYER_ITEM_MENU')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

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

  // const handleLayerSortEnd: SortEndHandler = useFunk((sort) => {
  //   executeOperation(EditorOps.moveLayer)
  //   // layerControls.moveLayer(sort.oldIndex, sort.newIndex)
  // })

  const handleLayerDragEnd = useFunk(({ active, over }: DragEndEvent) => {
    const moves = calcLayerMove(flatLayers, { active, over })
    if (!moves) return

    executeOperation(
      EditorOps.moveLayer,
      moves.sourcePath,
      moves.oldIndex,
      moves.newIndex
    )
  })

  const handleChangeLayerName = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      setLayerName(currentTarget.value)
      commitChangeLayerName(activeLayerPath, currentTarget.value)
    }
  )

  const commitChangeLayerName = useDebouncedFunk(
    (path: string[], layerName: string) => {
      executeOperation(
        EditorOps.runCommand,
        new SilkCommands.Layer.PatchLayerAttr({
          patch: { name: layerName },
          pathToTargetLayer: path,
        })
      )
    },
    1000
  )

  const handleChangeCompositeMode = useFunk((value: string) => {
    executeOperation(
      EditorOps.updateLayer,
      activeLayerPath,
      (layer) => (layer.compositeMode = value as any)
    )
  })

  const handleChangeOpacity = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayer) return

      executeOperation(EditorOps.updateLayer, activeLayerPath, (layer) => {
        layer.opacity = currentTarget.valueAsNumber
      })
    }
  )

  const handleOpenContextMenu = useFunk<
    PropsOf<typeof SortableLayerItem>['onContextMenu']
  >((e, path) => {
    contextMenu.show(e, { props: { layerPath: path } })
  })

  const handleClickDeleteLayer = useFunk(({ props }: LayerContextMenuParam) => {
    executeOperation(EditorOps.deleteLayer, props!.layerPath)
  })

  const container = useFunk((children: ReactNode) => <div>{children}</div>)

  const flatLayers = flattenLayers(layers)

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
              value={layerName}
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

      <div
        css={`
          height: 30vh;
          overflow: auto;
        `}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleLayerDragEnd}
        >
          <SortableContext
            items={flatLayers.map((l) => l.layer.uid)}
            strategy={verticalListSortingStrategy}
          >
            {flatLayers.map((layer) => (
              <SortableLayerItem
                key={layer.layer.uid}
                layer={layer}
                onContextMenu={handleOpenContextMenu}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <ContextMenu id={contextMenu.id}>
        <ContextMenuItem onClick={handleClickDeleteLayer}>削除</ContextMenuItem>
      </ContextMenu>

      {/* <SortableLayerList
            layers={[...layers].reverse()}
            onSortEnd={handleLayerSortEnd}
            distance={2}
            lockAxis={'y'}
          /> */}
    </SidebarPane>
  )
}

const SortableLayerItem = ({
  layer: { layer, path, depth },
  onContextMenu,
}: {
  layer: { path: string[]; layer: SilkDOM.LayerTypes; depth: number }
  onContextMenu: (e: MouseEvent<HTMLDivElement>, layerPath: string[]) => void
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: layer.uid })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const { t } = useTranslation('app')
  const theme = useTheme()

  const { executeOperation } = useFleurContext()
  const { activeLayer, activeLayerPath, thumbnailUrlOfLayer, activeObjectId } =
    useStore((get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      activeLayerPath: EditorSelector.activeLayerPath(get),
      currentDocument: EditorSelector.currentDocument(get),
      thumbnailUrlOfLayer: EditorSelector.thumbnailUrlOfLayer(get),
      activeObjectId: get(EditorStore).state.activeObjectId,
    }))

  const [objectsOpened, toggleObjectsOpened] = useToggle(false)

  const rootRef = useRef<HTMLDivElement | null>(null)

  const handleToggleVisibility = useFunk(() => {
    executeOperation(
      EditorOps.runCommand,
      new SilkCommands.Layer.PatchLayerAttr({
        patch: { visible: !layer.visible },
        pathToTargetLayer: [...path, layer.uid],
      })
    )
  })

  const handleChangeActiveLayer = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (
      DOMUtils.closestOrSelf(e.target, '[data-ignore-click]') ||
      DOMUtils.closestOrSelf(e.target, '[data-ignore-layer-click]')
    )
      return

    executeOperation(EditorOps.setActiveLayer, [...path, layer.uid])
  })

  const handleClickObject = useFunk(
    ({ currentTarget }: MouseEvent<HTMLDivElement>) => {
      executeOperation(
        EditorOps.setActiveObject,
        currentTarget.dataset.objectId ?? null,
        activeLayerPath
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
      executeOperation(
        EditorOps.runCommand,
        new SilkCommands.Layer.PatchLayerAttr({
          patch: { name: currentTarget.value },
          pathToTargetLayer: [...path, layer.uid],
        })
      )
    }
  )

  const handleContextMenu = useFunk((e: MouseEvent<HTMLDivElement>) => {
    onContextMenu(e, [...path, layer.uid])
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        ref={combineRef(rootRef)}
        css={`
          cursor: default;
          margin-left: ${depth * 16}px;
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
            padding: 2px;
            align-items: center;
          `}
          style={{
            backgroundColor:
              activeLayer?.uid === layer.uid
                ? theme.surface.sidebarListActive
                : '',
            color:
              activeLayer?.uid === layer.uid
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
            src={
              thumbnailUrlOfLayer(layer.uid) ??
              'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
            }
          />

          <div
            css={`
              width: 16px;
              flex: none;
              padding: 0 2px;
            `}
          >
            <Tooltip2
              placement="right"
              content={t(`layerType.${layer.layerType}`)}
            >
              {layer.layerType === 'filter' && (
                <Filter3
                  css={`
                    font-size: 16px;
                  `}
                />
              )}
              {layer.layerType === 'raster' && (
                <Brush
                  css={`
                    font-size: 16px;
                  `}
                />
              )}
              {layer.layerType === 'text' &&
                // <Text
                //   css={`
                //     font-size: 16px;
                //   `}
                // />
                'T'}
              {layer.layerType === 'vector' && (
                <Guide
                  css={`
                    font-size: 16px;
                  `}
                />
              )}
            </Tooltip2>
          </div>

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
              </>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type LayerContextMenuParam = ContextMenuParam<{ layerPath: string[] }>
