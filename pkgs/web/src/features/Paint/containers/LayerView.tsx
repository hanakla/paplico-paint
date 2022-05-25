import {
  ChangeEvent,
  memo,
  MouseEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { PapCommands, PapDOM, PapHelper } from '@paplico/core'
import { useClickAway, useToggle, useUpdate } from 'react-use'
import {
  loadImageFromBlob,
  selectFile,
  useFunk,
  useObjectState,
} from '@hanakla/arma'
import { rgba } from 'polished'
import {
  Add,
  Brush,
  DeleteBin,
  Filter3,
  Guide,
  Shape,
} from '@styled-icons/remix-fill'
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
import { ThemeProp, tm } from '🙌/utils/theme'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Tooltip2 } from '🙌/components/Tooltip2'
import { useBufferedState, useDebouncedFunk, useFleur } from '🙌/utils/hooks'
import { shallowEquals } from '🙌/utils/object'
import { useHover } from 'react-use-gesture'
import { CommandOps } from '../../../domains/Commands'
import {
  useLayerWatch,
  useActiveLayerPane,
  useDocumentWatch,
  useLayerListWatch,
  useVectorObjectWatch,
} from '../hooks'
import { shift, useFloating } from '@floating-ui/react-dom'
import { LayerNameText } from '../../../components/LayerNameText'

export const LayerView = memo(function LayerView() {
  const { t } = useTranslation('app')

  const rerender = useUpdate()
  const { execute } = useFleur()
  const { executeOperation } = useFleurContext()
  const { activeLayer, currentDocument, layers } = useStore((get) => ({
    activeLayer: EditorSelector.activeLayer(get),
    layers: EditorSelector.layers(get),
    currentDocument: EditorSelector.currentDocument(get),
  }))

  const [layerSorting, setLayerSorting] = useState(false)
  const [layerTypeOpened, toggleAddLayerOpened] = useToggle(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const addLayerFl = useFloating({
    strategy: 'absolute',
    placement: 'bottom-end',
    middleware: [shift()],
  })

  useClickAway(addLayerFl.refs.floating, (e) => {
    toggleAddLayerOpened(false)
  })

  const handleClickAddLayerItem = useFunk(
    async ({ currentTarget }: MouseEvent<HTMLLIElement>) => {
      if (!currentDocument) return

      const layerType = currentTarget.dataset.layerType!
      const lastLayerId = activeLayer?.uid
      const { width, height } = currentDocument

      let layer: PapDOM.LayerTypes
      switch (layerType) {
        case 'raster': {
          layer = PapDOM.RasterLayer.create({ width, height })
          break
        }
        case 'vector': {
          layer = PapDOM.VectorLayer.create({})
          break
        }
        case 'filter': {
          layer = PapDOM.FilterLayer.create({})
          break
        }
        case 'image': {
          const [file] = await selectFile({
            extensions: ['.jpg', '.jpeg', '.png'],
          })
          if (!file) return

          const { image } = await loadImageFromBlob(file)
          layer = await PapHelper.imageToLayer(image)
          break
        }
        default:
          throw new Error('なんかおかしなっとるで')
      }

      execute(
        EditorOps.runCommand,
        new PapCommands.Document.AddLayer({
          layer,
          aboveOnLayerId: lastLayerId,
        })
      )
      execute(EditorOps.setActiveLayer, [layer.uid])

      toggleAddLayerOpened(false)
    }
  )

  const handleLayerDragStart = useFunk(() => {
    setLayerSorting(true)
  })

  const handleLayerDragEnd = useFunk(({ active, over }: DragEndEvent) => {
    const moves = calcLayerMove(flatLayers, { active, over })
    if (!moves) return

    setLayerSorting(false)
    executeOperation(
      EditorOps.runCommand,
      new PapCommands.Layer.MoveLayer({
        sourcePath: moves.sourcePath,
        targetGroupPath: moves.targetParentPath,
        targetIndex: moves.targetIndex,
      })
    )
  })

  const container = useFunk((children: ReactNode) => (
    <div
      css={`
        display: flex;
        flex-flow: column;
        flex: 1;
      `}
    >
      {children}
    </div>
  ))

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

  useDocumentWatch(currentDocument)
  useLayerListWatch(
    flatLayers.filter((e) => e.type === 'layer').map((e) => e.layer)
  )

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
          display: flex;
          padding: 4px;
          ${tm((o) => [o.border.default.bottom])}
        `}
      >
        <div
          css={`
            display: flex;
            margin-left: auto;
            justify-content: flex-end;
            user-select: none;
          `}
        >
          <div ref={addLayerFl.reference} onClick={toggleAddLayerOpened}>
            <Add css="width: 16px;" />
          </div>
        </div>

        <Portal>
          <ul
            ref={addLayerFl.floating}
            css={css`
              background-color: ${({ theme }) => theme.color.surface3};
              box-shadow: 0 0 4px ${rgba('#000', 0.5)};
              color: ${({ theme }) => theme.text.white};
              z-index: 1;
              border-radius: 4px;
              overflow: hidden;

              li {
                padding: 8px;
                user-select: none;
              }
              li:hover {
                /* color: #000; */
                background-color: ${({ theme }) => theme.exactColors.active40};
              }
            `}
            style={{
              position: addLayerFl.strategy,
              left: addLayerFl.x ?? 0,
              top: addLayerFl.y ?? 0,
              ...(layerTypeOpened
                ? { visibility: 'visible', pointerEvents: 'all' }
                : { visibility: 'hidden', pointerEvents: 'none' }),
            }}
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
              {t('addFromImage')}
            </li>
          </ul>
        </Portal>
      </div>

      <div
        css={`
          flex: 1;
          /* background-color: ${({ theme }: ThemeProp) =>
            theme.exactColors.blackFade20}; */
        `}
        style={{ overflow: layerSorting ? 'hidden' : 'auto' }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleLayerDragStart}
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
    const { layer, parentPath, depth } = entry

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

    const {
      activeLayer,
      thumbnailUrlOfLayer,
      isInHighlightedLayer,
      selectedLayerUids,
    } = useStore((get) => ({
      activeLayer: EditorSelector.activeLayer(get),
      thumbnailUrlOfLayer: EditorSelector.thumbnailUrlOfLayer(get),
      isInHighlightedLayer: EditorSelector.isInHighlightedLayer(get),
      selectedLayerUids: EditorSelector.selectedLayerUids(get),
    }))

    const [objectsOpened, toggleObjectsOpened] = useToggle(false)

    const rootRef = useRef<HTMLDivElement | null>(null)

    const handleToggleVisibility = useFunk(() => {
      execute(
        EditorOps.runCommand,
        new PapCommands.Layer.PatchLayerAttr({
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
          new PapCommands.Layer.PatchLayerAttr({
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
        const layer = PapDOM.ReferenceLayer.create({
          referencedLayerId: props!.layerPath.slice(-1)[0],
        })

        execute(
          EditorOps.runCommand,
          new PapCommands.Document.AddLayer({
            layer,
            aboveOnLayerId: props!.layerPath.slice(-1)[0],
          })
        )
      }
    )

    const handleClickDuplicateLayer = useFunk(() => {
      execute(
        EditorOps.runCommand,
        new PapCommands.Layer.DuplicateLayer({
          pathToSourceLayer: [...parentPath, layer.uid],
        })
      )
    })

    const handleClickDeleteLayer = useFunk(
      ({ props }: LayerContextMenuParam) => {
        execute(
          EditorOps.runCommand,
          new PapCommands.Layer.DeleteLayer({
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
              new PapCommands.Layer.DeleteLayer({
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

      execute(EditorOps.setHighlightedLayers, (ids) => {
        if (hovering) [...ids, layer.referencedLayerId]
        else ids.filter((id) => id !== layer.referencedLayerId)
      })
    })

    useLayerWatch(layer)

    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        {process.env.NODE_ENV === 'development' && (
          <Tooltip2 placement="right" usePortal>
            <>uid: {layer.uid}</>
          </Tooltip2>
        )}
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
                : isInHighlightedLayer(layer.uid) ? theme.exactColors.orange20
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
              {layer.visible ? <Eye width={16} /> : <EyeClose width={16} />}
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
              <Tooltip2 placement="right">
                {t(`layerType.${layer.layerType}`)}
              </Tooltip2>
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
              <LayerNameText name={layer.name} layerType={layer.layerType} />
            </div>
          </div>
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
            {t('layerView.context.convertToSubstance')}
          </ContextMenuItem>
          <ContextMenuItem
            hidden={layer.layerType === 'reference'}
            onClick={handleClickMakeReferenceLayer}
          >
            {t('layerView.context.makeReference')}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleClickDuplicateLayer}>
            {t('layerView.context.duplicate')}
          </ContextMenuItem>
          <Separator />
          <ContextMenuItem onClick={handleClickDeleteLayer}>
            {t('remove')}
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

const SortableObjectItem = memo(function SortableObjectItem({
  entry,
}: {
  entry: FlatLayerEntry
}) {
  if (entry.type !== 'object') return null
  const { id, object, parentPath, depth } = entry

  const { t } = useTranslation('app')
  const theme = useTheme()
  const { execute } = useFleur()
  const { activeObject } = useStore((get) => ({
    activeObject: EditorSelector.activeObject(get),
  }))

  const objectMenu = useContextMenu()

  useVectorObjectWatch(object)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
  } = useSortable({
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

  const handleToggleVisibility = useFunk(() => {
    execute(
      EditorOps.runCommand,
      new PapCommands.VectorLayer.PatchObjectAttr({
        pathToTargetLayer: parentPath,
        objectUid: object.uid,
        patcher: (attrs) => {
          attrs.visible = !attrs.visible
        },
      })
    )
  })

  const handleClickDeleteObject = useFunk(
    (e: ContextMenuParam<{ layerPath: string[]; objectId: string }>) => {
      execute(
        EditorOps.runCommand,
        new PapCommands.VectorLayer.DeleteObject({
          pathToTargetLayer: parentPath,
          objectUid: e.props!.objectId,
        })
      )
    }
  )

  const handleClickRemoveObject = useFunk(() => {
    execute(
      EditorOps.runCommand,
      new PapCommands.VectorLayer.DeleteObject({
        pathToTargetLayer: parentPath,
        objectUid: object.uid,
      })
    )
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <>
      <div
        ref={setNodeRef}
        css={`
          display: flex;
          gap: 4px;
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
      >
        <div
          css={css`
            display: inline-block;
            color: ${({ theme }) => theme.colors.white10};
          `}
          style={{
            ...(object.visible ? {} : { opacity: 0.5 }),
          }}
          onClick={handleToggleVisibility}
          data-ignore-click
        >
          {object.visible ? <Eye width={16} /> : <EyeClose width={16} />}
        </div>

        <div
          css={`
            display: inline-block;
            flex: 1;
          `}
          data-object-id={object.uid}
          onClick={handleClickObject}
          onContextMenu={handleObjectContextMenu}
          {...attributes}
          {...listeners}
        >
          {t('layerView.object.path')}
        </div>

        <div onClick={handleClickRemoveObject}>
          <DeleteBin width={16} />
        </div>
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
  const {
    state: { activeLayer, layerName },
    handleChangeLayerName,
    handleChangeCompositeMode,
    handleChangeOpacity,
  } = useActiveLayerPane()

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

type LayerContextMenuParam = ContextMenuParam<{ layerPath: string[] }>
