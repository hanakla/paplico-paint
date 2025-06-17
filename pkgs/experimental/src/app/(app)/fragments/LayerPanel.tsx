'use client'

import { useEventCallback } from '@paplico/shared-lib/react'
import { useSnapshot } from 'valtio'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import {
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FileImage,
  Layers,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
  UniqueIdentifier,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  DragOverEvent,
  useDndMonitor,
  useDroppable,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useState, memo } from 'react'
import {
  engineState,
  addLayer,
  removeLayer,
  removeArtObject,
  toggleLayerVisibility,
  setLayerOpacity,
  setActiveLayer,
  reorderLayers,
  addGroupLayer,
  toggleGroupExpanded,
  toggleLayerArtObjectsExpanded,
  getExtendedTree,
  moveLayerToGroup,
  moveArtObjectToLayer,
  type ExtendedTreeItem,
} from '@/engine/state'
import type { Layer, GroupLayer, LayerNode } from '@/engine/document/layer'

interface ExtendedTreeItemProps {
  treeItem: ExtendedTreeItem
  isActive: boolean
  onVisibilityToggle: (id: string, type: 'layer' | 'artObject') => void
  onSetActive: (id: string, type: 'layer' | 'artObject') => void
  onRemove: (id: string, type: 'layer' | 'artObject') => void
  onOpacityChange: (
    id: string,
    opacity: number,
    type: 'layer' | 'artObject',
  ) => void
  onToggleExpanded: (id: string, type: 'layer' | 'artObject') => void
  canDelete: boolean
  isDraggedOver?: boolean
}

interface DropZoneProps {
  layerId: string
  depth: number
  isActive: boolean
  position: 'before' | 'inside' | 'after'
}

const DropZone = memo(
  ({ layerId, depth, isActive, position }: DropZoneProps) => {
    const { setNodeRef } = useDroppable({
      id: `${position}-${layerId}`,
    })

    if (!isActive) return null

    const marginLeft =
      position === 'inside' ? `${(depth + 1) * 20}px` : `${depth * 20}px`

    return (
      <div
        ref={setNodeRef}
        className={`h-1 bg-primary/20 border border-dashed border-primary rounded transition-all duration-200 ${
          position === 'inside' ? 'bg-primary/30' : ''
        }`}
        style={{ marginLeft }}
      />
    )
  },
)

const ExtendedTreeItemComponent = ({
  treeItem,
  isActive,
  onVisibilityToggle,
  onSetActive,
  onRemove,
  onOpacityChange,
  onToggleExpanded,
  canDelete,
  isDraggedOver,
}: ExtendedTreeItemProps) => {
  const snap = useSnapshot(engineState)

  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: treeItem.id,
      data: {
        type: treeItem.type,
        item: treeItem,
      },
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // 強制的にValtioの再レンダリングをトリガーするためにsnap.documentを参照
  const document = snap.document
  const layer =
    treeItem.type === 'layer' && document?.layers[treeItem.id]
      ? document.layers[treeItem.id]
      : null
  const currentOpacity = layer?.opacity || 1

  // デバッグ用：現在の透明度を表示
  useEffect(() => {
    if (treeItem.type === 'layer') {
      console.log(
        `🔍 Layer ${treeItem.name} opacity from useSnapshot:`,
        currentOpacity,
      )
    }
  }, [currentOpacity, treeItem.name, treeItem.type])
  const currentLayerType = layer?.type

  // デバッグ用：opacityの変更をログ出力
  useEffect(() => {
    if (treeItem.type === 'layer') {
      console.log(
        `🔍 Layer ${treeItem.id} (${treeItem.name}) opacity:`,
        currentOpacity,
        'layer object:',
        layer,
      )
    }
  }, [currentOpacity, treeItem.id, treeItem.type, treeItem.name, layer])

  // アイコンを決定
  const getIcon = () => {
    if (treeItem.type === 'layer') {
      if (currentLayerType === 'group') {
        return treeItem.isExpanded ? (
          <FolderOpen className="w-4 h-4" />
        ) : (
          <Folder className="w-4 h-4" />
        )
      }
      return <Layers className="w-4 h-4" />
    } else {
      // artObject
      return <FileImage className="w-4 h-4" />
    }
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* メイン行 */}
      <div
        className={`
          flex items-center min-h-[32px] px-2 py-1 hover:bg-accent/50 rounded-md cursor-pointer
          ${isActive ? 'bg-accent' : ''}
          ${isDraggedOver ? 'bg-secondary/50' : ''}
        `}
        onClick={(e) => {
          e.stopPropagation()
          onSetActive(treeItem.id, treeItem.type)
        }}
      >
        {/* インデント */}
        <div style={{ width: `${treeItem.depth * 16}px` }} />

        {/* 展開/折りたたみボタン */}
        {treeItem.hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpanded(treeItem.id, treeItem.type)
            }}
            className="w-4 h-4 p-0 mr-1"
          >
            {treeItem.isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </Button>
        ) : (
          <div className="w-4 mr-1" />
        )}

        {/* アイコン */}
        <div className="w-4 h-4 mr-2 flex items-center justify-center">
          {getIcon()}
        </div>

        {/* 名前 */}
        <span
          className={`text-sm flex-1 truncate ${
            treeItem.type === 'artObject' ? 'text-muted-foreground' : ''
          }`}
          {...listeners}
          style={{ cursor: 'grab' }}
        >
          {treeItem.name}
        </span>

        {/* 不透明度表示（レイヤーのみ） */}
        {treeItem.type === 'layer' && (
          <span className="text-xs text-muted-foreground mr-2">
            {Math.round(currentOpacity * 100)}%
          </span>
        )}

        {/* 表示/非表示ボタン */}
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onVisibilityToggle(treeItem.id, treeItem.type)
          }}
          className="w-6 h-6 p-0 ml-1 opacity-60 hover:opacity-100"
        >
          {treeItem.visible ? (
            <Eye className="w-3 h-3" />
          ) : (
            <EyeOff className="w-3 h-3" />
          )}
        </Button>

        {/* 削除ボタン */}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(treeItem.id, treeItem.type)
            }}
            className="w-6 h-6 p-0 ml-1 opacity-60 hover:opacity-100 hover:text-destructive"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* 透明度スライダー（レイヤーの場合のみ表示） */}
      {treeItem.type === 'layer' && (
        <div
          className="px-2 pb-2"
          style={{ marginLeft: `${(treeItem.depth + 1) * 16 + 24}px` }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center space-x-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              不透明度:
            </Label>
            <Slider
              value={[currentOpacity * 100]}
              onValueChange={(value) =>
                onOpacityChange(treeItem.id, value[0] / 100, treeItem.type)
              }
              max={100}
              min={0}
              step={1}
              className="flex-1 h-4"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
            <span className="text-xs text-muted-foreground w-8">
              {Math.round(currentOpacity * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

const DragOverlayItem = memo(({ layer }: { layer: Layer }) => (
  <Card className="ring-2 ring-primary opacity-80">
    <CardContent className="p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            {layer.visible ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </Button>
          <span className="text-sm font-medium">{layer.name}</span>
        </div>
      </div>
    </CardContent>
  </Card>
))

export const LayerPanel = memo(() => {
  const snap = useSnapshot(engineState)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null)

  // snapを使って確実にリアクティブ更新をトリガー
  const extendedTree = snap.document ? getExtendedTree(snap.document) : []

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const measuring = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  }

  const customCollisionDetection = useEventCallback((args) => {
    const pointerIntersections = pointerWithin(args)
    const intersections =
      pointerIntersections.length > 0
        ? pointerIntersections
        : rectIntersection(args)

    let overId = getFirstCollision(intersections, 'id')

    if (overId != null) {
      const overItem = extendedTree.find((item) => item.id === overId)
      if (
        overItem?.type === 'layer' &&
        overItem.layer?.type === 'group' &&
        overItem.isExpanded
      ) {
        const childIds = extendedTree
          .filter(
            (item) => item.type === 'layer' && item.parentLayerId === overId,
          )
          .map((item) => item.id)

        const childIntersections = intersections.filter((intersection) =>
          childIds.includes(intersection.id as string),
        )

        if (childIntersections.length > 0) {
          overId = getFirstCollision(childIntersections, 'id')
        }
      }
    }

    return overId ? [{ id: overId }] : []
  })

  const handleDragStart = useEventCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  })

  const handleDragOver = useEventCallback((event: DragOverEvent) => {
    setOverId(event.over?.id ?? null)
  })

  const handleDragEnd = useEventCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over || active.id === over.id) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeItem = extendedTree.find((item) => item.id === activeId)
    const overItem = extendedTree.find((item) => item.id === overId)

    // Handle drop zones (with position prefixes)
    if (overId.includes('-')) {
      const [position, targetId] = overId.split('-')
      const targetItem = extendedTree.find((item) => item.id === targetId)

      if (position === 'inside' && targetItem?.type === 'layer') {
        if (activeItem?.type === 'layer') {
          // Layer to group/layer
          if (targetItem.layer?.type === 'group') {
            moveLayerToGroup(activeId, targetId)
          }
        } else if (activeItem?.type === 'artObject') {
          // ArtObject to layer
          moveArtObjectToLayer(activeId, targetId)
        }
      } else {
        if (activeItem?.type === 'layer' && targetItem?.type === 'layer') {
          // Get parent ID from document structure
          const targetNode = snap.document?.layerNodes.find(
            (n) => n.layerId === targetId,
          )
          moveLayerToGroup(activeId, targetNode?.parentId || null)
        }
      }
    } else {
      // Handle direct item drops
      if (activeItem && overItem) {
        if (activeItem.type === 'layer' && overItem.type === 'layer') {
          // Layer to layer movement
          if (overItem.layer?.type === 'group' && overItem.isExpanded) {
            moveLayerToGroup(activeId, overItem.id)
          } else {
            // Get parent from document structure
            const overNode = snap.document?.layerNodes.find(
              (n) => n.layerId === overItem.id,
            )
            moveLayerToGroup(activeId, overNode?.parentId || null)
          }
        } else if (
          activeItem.type === 'artObject' &&
          overItem.type === 'layer'
        ) {
          // ArtObject to layer movement
          moveArtObjectToLayer(activeId, overItem.id)
        } else if (
          activeItem.type === 'artObject' &&
          overItem.type === 'artObject'
        ) {
          // ArtObject to same layer as another artObject
          if (overItem.parentLayerId) {
            moveArtObjectToLayer(activeId, overItem.parentLayerId)
          }
        }
      }
    }
  })

  const handleAddLayer = useEventCallback(() => {
    addLayer(`レイヤー ${snap.layers.length + 1}`)
  })

  const handleAddGroupLayer = useEventCallback(() => {
    addGroupLayer(
      `グループ ${snap.layers.filter((l) => l.type === 'group').length + 1}`,
    )
  })

  const handleLayerVisibilityToggle = useEventCallback((layerId: string) => {
    toggleLayerVisibility(layerId)
  })

  const handleSetActiveLayer = useEventCallback((layerId: string) => {
    setActiveLayer(layerId)
  })

  const handleSetLayerOpacity = useEventCallback(
    (layerId: string, opacity: number) => {
      setLayerOpacity(layerId, opacity)
    },
  )

  const handleRemoveLayer = useEventCallback((layerId: string) => {
    removeLayer(layerId)
  })

  const handleToggleExpanded = useEventCallback((layerId: string) => {
    toggleGroupExpanded(layerId)
  })

  // 拡張ツリー用ハンドラー
  const handleExtendedVisibilityToggle = useEventCallback(
    (id: string, type: 'layer' | 'artObject') => {
      if (type === 'layer') {
        toggleLayerVisibility(id)
      } else {
        // artObjectの表示/非表示切り替え
        if (engineState.document) {
          const artObject = engineState.document.artObjects.get(id)
          if (artObject) {
            artObject.visible = !artObject.visible
          }
        }
      }
    },
  )

  const handleExtendedSetActive = useEventCallback(
    (id: string, type: 'layer' | 'artObject') => {
      if (type === 'layer') {
        setActiveLayer(id)
      } else {
        // artObjectの選択（将来の拡張用）
        console.log('ArtObject selected:', id)
      }
    },
  )

  const handleExtendedRemove = useEventCallback(
    (id: string, type: 'layer' | 'artObject') => {
      if (type === 'layer') {
        removeLayer(id)
      } else {
        removeArtObject(id)
      }
    },
  )

  const handleExtendedOpacityChange = useEventCallback(
    (id: string, opacity: number, type: 'layer' | 'artObject') => {
      if (type === 'layer') {
        setLayerOpacity(id, opacity)
      } else {
        // artObjectの不透明度変更（将来の拡張用）
        console.log('ArtObject opacity change:', id, opacity)
      }
    },
  )

  const handleExtendedToggleExpanded = useEventCallback(
    (id: string, type: 'layer' | 'artObject') => {
      if (type === 'layer') {
        const treeItem = extendedTree.find(
          (item) => item.id === id && item.type === 'layer',
        )
        if (treeItem?.layer?.type === 'group') {
          toggleGroupExpanded(id)
        } else {
          toggleLayerArtObjectsExpanded(id)
        }
      }
    },
  )

  const activeLayer = activeId
    ? snap.layers.find((layer) => layer.id === activeId)
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">レイヤー</h3>
        <div className="flex space-x-2">
          <Button size="sm" onClick={handleAddLayer}>
            <Plus className="w-4 h-4 mr-1" />
            レイヤー
          </Button>
          <Button size="sm" variant="outline" onClick={handleAddGroupLayer}>
            <Folder className="w-4 h-4 mr-1" />
            グループ
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        measuring={measuring}
      >
        <SortableContext
          items={extendedTree.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-0.5">
            {extendedTree.map((treeItem, index) => (
              <div key={treeItem.id}>
                {/* ドロップゾーン: 前 */}
                <DropZone
                  layerId={treeItem.id}
                  depth={treeItem.depth}
                  isActive={
                    activeId !== null && overId === `before-${treeItem.id}`
                  }
                  position="before"
                />

                <ExtendedTreeItemComponent
                  treeItem={treeItem}
                  isActive={
                    treeItem.type === 'layer' &&
                    treeItem.id === snap.document?.activeLayerId
                  }
                  onVisibilityToggle={handleExtendedVisibilityToggle}
                  onSetActive={handleExtendedSetActive}
                  onRemove={handleExtendedRemove}
                  onOpacityChange={handleExtendedOpacityChange}
                  onToggleExpanded={handleExtendedToggleExpanded}
                  canDelete={
                    treeItem.type === 'layer'
                      ? Object.keys(snap.document?.layers || {}).length > 1
                      : true
                  }
                  isDraggedOver={
                    overId === treeItem.id || overId === `inside-${treeItem.id}`
                  }
                />

                {/* ドロップゾーン: グループ内 */}
                {treeItem.type === 'layer' &&
                  snap.document?.layers[treeItem.id]?.type === 'group' &&
                  treeItem.isExpanded && (
                    <DropZone
                      layerId={treeItem.id}
                      depth={treeItem.depth + 1}
                      isActive={
                        activeId !== null && overId === `inside-${treeItem.id}`
                      }
                      position="inside"
                    />
                  )}

                {/* ドロップゾーン: 後（最後のアイテムの場合） */}
                {index === extendedTree.length - 1 && (
                  <DropZone
                    layerId={treeItem.id}
                    depth={treeItem.depth}
                    isActive={
                      activeId !== null && overId === `after-${treeItem.id}`
                    }
                    position="after"
                  />
                )}
              </div>
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeLayer && <DragOverlayItem layer={activeLayer} />}
        </DragOverlay>
      </DndContext>
    </div>
  )
})

LayerPanel.displayName = 'LayerPanel'
