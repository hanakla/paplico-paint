import {
  ChangeEvent,
  memo,
  MouseEvent,
  ReactNode,
  useEffect,
  useRef,
} from 'react'
import { SilkCommands, SilkDOM, SilkHelper } from 'silk-core'
import { useClickAway, useToggle, useUpdate } from 'react-use'
import {
  loadImageFromBlob,
  selectFile,
  useFunk,
  useObjectState,
} from '@hanakla/arma'
import { rgba } from 'polished'
import { usePopper } from 'react-popper'
import { Add, Brush, Filter3, Guide, Shape } from '@styled-icons/remix-fill'
import { css } from 'styled-components'
import { Portal } from '🙌/components/Portal'
import { centering, rangeThumb } from '🙌/utils/mixins'
import { useTranslation } from 'next-i18next'
import { ArrowDownS, Stack } from '@styled-icons/remix-line'
import { Eye, EyeClose } from '@styled-icons/remix-fill'
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuParam,
  Separator,
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
import {
  calcLayerMove,
  FlatLayerEntry,
  flattenLayers,
  isEventIgnoringTarget,
} from '../helpers'
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
import { useBufferedState, useDebouncedFunk, useFleur } from '🙌/utils/hooks'
import { shallowEquals } from '🙌/utils/object'
import { useHover } from 'react-use-gesture'
import { createSlice, useLysSliceRoot, useLysSlice } from '@fleur/lys'
import { CommandOps } from '../../../domains/Commands'
import { useLayerWatch } from '../hooks'

export const LayerView = memo(function LayerView() {
  const { t } = useTranslation('app')

  const rerender = useUpdate()
  const { executeOperation } = useFleurContext()
  const { activeLayer, activeLayerPath, currentDocument, layers } = useStore(
    (get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      activeLayerPath: EditorSelector.activeLayerPath(get),
      layers: EditorSelector.layers(get),
      currentDocument: EditorSelector.currentDocument(get),
    })
  )
  const [layeViewState, layerViewActions] = useLysSliceRoot(layerViewSlice)

  const [layerTypeOpened, toggleLayerTypeOpened] = useToggle(false)
  const layerTypeOpenerRef = useRef<HTMLDivElement | null>(null)
  const layerTypeDropdownRef = useRef<HTMLUListElement | null>(null)

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
      EditorOps.runCommand,
      new SilkCommands.Layer.MoveLayer({
        sourcePath: moves.sourcePath,
        targetGroupPath: moves.targetParentPath,
        targetIndex: moves.targetIndex,
      })
    )
  })

  const container = useFunk((children: ReactNode) => <div>{children}</div>)

  useEffect(() => {
    const doc = currentDocument

    doc?.on('layersChanged', rerender)
    return () => {
      doc?.off('layersChanged', rerender)
    }
  }, [currentDocument?.uid])

  const [collapsed, setCollapsed] = useObjectState<Record<string, boolean>>({})
  const flatLayers = flattenLayers(layers, (entry) => {
    return (
      entry.parentId == null ||
      (entry.parentId != null && !(collapsed[entry.parentId] ?? true))
    )
  })

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
      <ActiveLayerPane />

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
              {/* <label> */}
              {t('addFromImage')}
              {/* <input
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
              </label> */}
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
            items={flatLayers.map((entry) => entry.id)}
            strategy={verticalListSortingStrategy}
          >
            {flatLayers.map((entry) =>
              entry.type === 'layer' ? (
                <SortableLayerItem
                  key={entry.id}
                  entry={entry}
                  onToggleCollapse={(id) =>
                    setCollapsed((state) => {
                      state[id] = !(state[id] ?? true)
                      console.log(state, id)
                    })
                  }
                />
              ) : (
                <SortableObjectItem key={entry.id} entry={entry} />
              )
            )}
          </SortableContext>
        </DndContext>
      </div>

      {/* <SortableLayerList
            layers={[...layers].reverse()}
            onSortEnd={handleLayerSortEnd}
            distance={2}
            lockAxis={'y'}
          /> */}
    </SidebarPane>
  )
})

const SortableLayerItem = memo(
  ({
    entry,
    onToggleCollapse,
  }: {
    entry: FlatLayerEntry
    onToggleCollapse: (id: string) => void
  }) => {
    if (entry.type !== 'layer') return null

    const { id, layer, parentPath, depth } = entry

    const contextMenu = useContextMenu()
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({
        id: entry.id,
        animateLayoutChanges: ({ isSorting, wasDragging }) =>
          isSorting || wasDragging ? false : true,
      })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    }

    const { t } = useTranslation('app')
    const theme = useTheme()

    const { execute } = useFleur()
    const [layeViewState, layerViewActions] = useLysSlice(layerViewSlice)
    const {
      activeLayer,
      activeLayerPath,
      thumbnailUrlOfLayer,
      activeObjectId,
      selectedLayerUids,
    } = useStore((get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      activeLayerPath: EditorSelector.activeLayerPath(get),
      currentDocument: EditorSelector.currentDocument(get),
      thumbnailUrlOfLayer: EditorSelector.thumbnailUrlOfLayer(get),
      activeObjectId: get(EditorStore).state.activeObjectId,
      selectedLayerUids: EditorSelector.selectedLayerUids(get),
    }))

    const [objectsOpened, toggleObjectsOpened] = useToggle(false)

    const rootRef = useRef<HTMLDivElement | null>(null)

    const handleToggleVisibility = useFunk(() => {
      execute(
        EditorOps.runCommand,
        new SilkCommands.Layer.PatchLayerAttr({
          patch: { visible: !layer.visible },
          pathToTargetLayer: [...parentPath, layer.uid],
        })
      )
    })

    const handleClickRoot = useFunk((e: MouseEvent<HTMLDivElement>) => {
      if (
        DOMUtils.closestOrSelf(e.target, '[data-ignore-click]') ||
        DOMUtils.closestOrSelf(e.target, '[data-ignore-layer-click]')
      )
        return

      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        execute(EditorOps.setLayerSelection, (uids) => {
          if (uids.includes(layer.uid)) {
            return uids.filter((uid) => uid !== layer.uid)
          } else {
            return [...uids, layer.uid]
          }
        })
      } else {
        execute(EditorOps.setLayerSelection, () => [layer.uid])
        execute(EditorOps.setActiveLayer, [...parentPath, layer.uid])
      }
    })

    const handleChangeActiveLayerToReferenceTarget = useFunk(
      (e: MouseEvent<SVGElement>) => {
        if (
          DOMUtils.closestOrSelf(e.target, '[data-ignore-click]') ||
          DOMUtils.closestOrSelf(e.target, '[data-ignore-layer-click]') ||
          layer.layerType !== 'reference'
        )
          return

        e.stopPropagation()

        execute(
          EditorOps.setActiveLayerToReferenceTarget,
          layer.referencedLayerId
        )
      }
    )

    const handleChangeLayerName = useFunk(
      ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
        execute(
          EditorOps.runCommand,
          new SilkCommands.Layer.PatchLayerAttr({
            patch: { name: currentTarget.value },
            pathToTargetLayer: [...parentPath, layer.uid],
          })
        )
      }
    )

    const handleContextMenu = useFunk((e: MouseEvent<HTMLDivElement>) => {
      contextMenu.show(e, { props: { layerPath: [...parentPath, layer.uid] } })
    })

    const handleClickConvertToGroup = useFunk(() => {
      execute(CommandOps.convertToGroups)
    })

    const handleClickConvertToSubstance = useFunk(() => {
      execute(EditorOps.convertToSubstance, [...parentPath, layer.uid])
    })

    const handleClickMakeReferenceLayer = useFunk(
      ({ props }: LayerContextMenuParam) => {
        const layer = SilkDOM.ReferenceLayer.create({
          referencedLayerId: props!.layerPath.slice(-1)[0],
        })

        execute(
          EditorOps.runCommand,
          new SilkCommands.Document.AddLayer({
            layer,
            aboveOnLayerId: props!.layerPath.slice(-1)[0],
          })
        )
      }
    )

    const handleClickDeleteLayer = useFunk(
      ({ props }: LayerContextMenuParam) => {
        execute(
          EditorOps.runCommand,
          new SilkCommands.Layer.DeleteLayer({
            pathToTargetLayer: props!.layerPath,
          })
        )
      }
    )

    const handleClickCollapse = useFunk(() => {
      toggleObjectsOpened()
      onToggleCollapse(entry.id)
    })

    useMouseTrap(
      rootRef,
      [
        {
          key: ['del', 'backspace'],
          handler: () => {
            execute(
              EditorOps.runCommand,
              new SilkCommands.Layer.DeleteLayer({
                pathToTargetLayer: [...parentPath, layer.uid],
              })
            )
          },
        },
      ],
      [layer]
    )

    const bindReferenceHover = useHover(({ hovering }) => {
      if (layer.layerType !== 'reference') return

      layerViewActions.set({
        hoveredReferenceTargetUid: hovering ? layer.referencedLayerId : null,
      })
    })

    useLayerWatch(layer)

    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <div
          ref={combineRef(rootRef)}
          css={`
            cursor: default;
            margin-left: ${depth * 16}px;
          `}
          onClick={handleClickRoot}
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
              // prettier-ignore
              backgroundColor:
                activeLayer?.uid === layer.uid ? theme.surface.sidebarListActive
                : selectedLayerUids.includes(layer.uid) ? rgba(theme.surface.sidebarListActive, .2)
                : layeViewState.isReferencerHovered(layer.uid) ? theme.exactColors.orange20
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
              {(layer.layerType === 'vector' ||
                layer.layerType === 'group') && (
                <ArrowDownS
                  css={`
                    width: 12px;
                  `}
                  style={{
                    transform: objectsOpened ? 'rotateZ(180deg)' : 'rotateZ(0)',
                  }}
                  onClick={handleClickCollapse}
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
                  <Shape
                    css={`
                      font-size: 16px;
                    `}
                  />
                )}
                {layer.layerType === 'reference' && (
                  <Guide
                    css={`
                      font-size: 16px;
                      border-bottom: 1px solid currentColor;
                      cursor: pointer;
                    `}
                    onClick={handleChangeActiveLayerToReferenceTarget}
                    {...bindReferenceHover()}
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

          {/* {layer.layerType === 'vector' && (
            <div
              css={`
                flex-basis: 100%;
                overflow: hidden;
              `}
              style={{
                height: objectsOpened ? 'auto' : 0,
              }}
            >
              {[...layer.objects].reverse().map((object) => (
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
                    onContextMenu={handleObjectContextMenu}
                    data-ignore-layer-click
                  >
                    パス
                  </div>
                </>
              ))}
            </div>
          )} */}
        </div>

        <ContextMenu id={contextMenu.id}>
          {selectedLayerUids.length >= 1 &&
            selectedLayerUids.includes(layer.uid) && (
              <>
                <ContextMenuItem onClick={handleClickConvertToGroup}>
                  選択したレイヤーをグループ化
                </ContextMenuItem>
                <Separator />
              </>
            )}
          <ContextMenuItem
            hidden={layer.layerType !== 'reference'}
            onClick={handleClickConvertToSubstance}
          >
            レイヤーに変換
          </ContextMenuItem>
          <ContextMenuItem
            hidden={layer.layerType === 'reference'}
            onClick={handleClickMakeReferenceLayer}
          >
            参照レイヤーをつくる
          </ContextMenuItem>
          <ContextMenuItem onClick={handleClickDeleteLayer}>
            削除
          </ContextMenuItem>
        </ContextMenu>
      </div>
    )
  },
  (prev, next) =>
    shallowEquals({ ...prev.entry.layer }, { ...next.entry.layer }) &&
    prev.entry.depth === next.entry.depth &&
    shallowEquals(prev.entry.path, next.entry.path)
)

const SortableObjectItem = memo(({ entry }: { entry: FlatLayerEntry }) => {
  if (entry.type !== 'object') return null
  const { id, object, parentPath, depth } = entry

  const { t } = useTranslation('app')
  const theme = useTheme()
  const { execute } = useFleur()
  const { activeObject } = useStore((get) => ({
    activeObject: EditorSelector.activeObject(get),
  }))

  const objectMenu = useContextMenu()

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: entry.id,
      animateLayoutChanges: ({ isSorting, wasDragging }) =>
        isSorting || wasDragging ? false : true,
    })

  const handleClickObject = useFunk(
    ({ currentTarget }: MouseEvent<HTMLDivElement>) => {
      execute(
        EditorOps.setActiveObject,
        currentTarget.dataset.objectId ?? null,
        parentPath
      )
    }
  )

  const handleObjectContextMenu = useFunk((e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()

    objectMenu.show(e, {
      props: {
        layerPath: parentPath,
        objectId: e.currentTarget.dataset.objectId!,
      },
    })
  })

  const handleClickDeleteObject = useFunk(
    (e: ContextMenuParam<{ layerPath: string[]; objectId: string }>) => {
      execute(
        EditorOps.runCommand,
        new SilkCommands.VectorLayer.DeleteObject({
          pathToTargetLayer: parentPath,
          objectUid: e.props!.objectId,
        })
      )
    }
  )

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <>
      <div
        ref={setNodeRef}
        css={`
          padding: 6px 8px;
          margin-left: 16px;
        `}
        style={{
          ...style,
          marginLeft: depth * 16,
          backgroundColor:
            activeObject?.uid === object.uid
              ? theme.surface.sidebarListActive
              : undefined,
        }}
        data-object-id={object.uid}
        onClick={handleClickObject}
        onContextMenu={handleObjectContextMenu}
        {...attributes}
        {...listeners}
      >
        {t('layerView.object.path')}
      </div>

      <ContextMenu id={objectMenu.id}>
        <ContextMenuItem onClick={handleClickDeleteObject}>
          {t('layerView.object.context.remove')}
        </ContextMenuItem>
      </ContextMenu>
    </>
  )
})

const ActiveLayerPane = memo(function ActiveLayerPane() {
  const { t } = useTranslation('app')

  const { execute } = useFleur()
  const { activeLayer, activeLayerPath } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    activeLayerPath: EditorSelector.activeLayerPath(get),
  }))

  useLayerWatch(activeLayer)

  const [layerName, setLayerName] = useBufferedState(activeLayer?.name)

  const handleChangeLayerName = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      setLayerName(currentTarget.value)
      commitChangeLayerName(activeLayerPath, currentTarget.value)
    }
  )

  const commitChangeLayerName = useDebouncedFunk(
    (path: string[], layerName: string) => {
      if (!activeLayerPath) return
      execute(
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
    if (!activeLayerPath) return

    execute(
      EditorOps.updateLayer,
      activeLayerPath,
      (layer) => (layer.compositeMode = value as any)
    )
  })

  const handleChangeOpacity = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayer) return

      execute(EditorOps.updateLayer, activeLayerPath, (layer) => {
        layer.opacity = currentTarget.valueAsNumber
      })
    }
  )

  return (
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
          placeholder={
            activeLayer
              ? `<${t(`layerType.${activeLayer.layerType}`)}>`
              : '<未選択>'
          }
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
            ...(!activeLayer ? [{ value: '', label: '---' }] : []),
            { value: 'normal', label: t('compositeModes.normal') },
            { value: 'multiply', label: t('compositeModes.multiply') },
            { value: 'screen', label: t('compositeModes.screen') },
            { value: 'overlay', label: t('compositeModes.overlay') },
            { value: 'clipper', label: t('compositeModes.clipper') },
          ]}
          value={activeLayer?.compositeMode ?? ''}
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
            value={activeLayer?.opacity ?? 100}
            onChange={handleChangeOpacity}
          />
        </div>
      </div>
    </div>
  )
})

const ObjectItem = memo(() => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: layer.uid })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
})

const layerViewSlice = createSlice(
  {
    actions: {},
    computed: {
      isReferencerHovered: (state) => (layerUid: string) =>
        layerUid === state.hoveredReferenceTargetUid,
    },
  },
  () => ({ hoveredReferenceTargetUid: null as string | null })
)

type LayerContextMenuParam = ContextMenuParam<{ layerPath: string[] }>
