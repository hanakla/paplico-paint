"use client";

import {
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	getFirstCollision,
	KeyboardSensor,
	MeasuringStrategy,
	PointerSensor,
	pointerWithin,
	rectIntersection,
	type UniqueIdentifier,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEventCallback } from "@paplico/shared-lib/react";
import {
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	FileImage,
	Folder,
	FolderOpen,
	Layers,
	Plus,
	Trash2,
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
// engineStateはPaplicoEngine経由でアクセス
import {
	addLayerToDocument,
	type ExtendedTreeItem,
	getExtendedTree,
	moveArtObjectToLayer,
	moveLayerToGroup,
	removeArtObjectFromDocument,
	removeLayerFromDocument,
	toggleGroupExpanded,
	toggleLayerArtObjectsExpanded,
} from "@/engine/document/document";
import type { Layer } from "@/engine/document/layer";
import { createGroupLayer, createVectorLayer } from "@/engine/document/layer";
import {
	editorState,
	getActiveDocument,
	setActiveLayer,
	setLayerOpacity,
	toggleLayerVisibility,
} from "@/stores/editor";

interface ExtendedTreeItemProps {
	treeItem: ExtendedTreeItem;
	isActive: boolean;
	onVisibilityToggle: (id: string, type: "layer" | "artObject") => void;
	onSetActive: (id: string, type: "layer" | "artObject") => void;
	onRemove: (id: string, type: "layer" | "artObject") => void;
	onOpacityChange: (
		id: string,
		opacity: number,
		type: "layer" | "artObject",
	) => void;
	onToggleExpanded: (id: string, type: "layer" | "artObject") => void;
	canDelete: boolean;
	isDraggedOver?: boolean;
}

interface DropZoneProps {
	layerId: string;
	depth: number;
	isActive: boolean;
	position: "before" | "inside" | "after";
}

const DropZone = memo(
	({ layerId, depth, isActive, position }: DropZoneProps) => {
		const { setNodeRef } = useDroppable({
			id: `${position}-${layerId}`,
		});

		if (!isActive) return null;

		const marginLeft =
			position === "inside" ? `${(depth + 1) * 20}px` : `${depth * 20}px`;

		return (
			<div
				ref={setNodeRef}
				className={`h-1 bg-primary/20 border border-dashed border-primary rounded transition-all duration-200 ${
					position === "inside" ? "bg-primary/30" : ""
				}`}
				style={{ marginLeft }}
			/>
		);
	},
);

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
	const _editorSnap = useSnapshot(editorState);

	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({
			id: treeItem.id,
			data: {
				type: treeItem.type,
				item: treeItem,
			},
		});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	// document は treeItem.layer から取得
	const layer =
		treeItem.type === "layer" && treeItem.layer ? treeItem.layer : null;
	const currentOpacity = layer?.opacity || 1;

	// デバッグ用：現在の透明度を表示
	useEffect(() => {
		if (treeItem.type === "layer") {
			console.log(
				`🔍 Layer ${treeItem.name} opacity from useSnapshot:`,
				currentOpacity,
			);
		}
	}, [currentOpacity, treeItem.name, treeItem.type]);
	const currentLayerType = layer?.type;

	// デバッグ用：opacityの変更をログ出力
	useEffect(() => {
		if (treeItem.type === "layer") {
			console.log(
				`🔍 Layer ${treeItem.id} (${treeItem.name}) opacity:`,
				currentOpacity,
				"layer object:",
				layer,
			);
		}
	}, [currentOpacity, treeItem.id, treeItem.type, treeItem.name, layer]);

	// アイコンを決定
	const getIcon = () => {
		if (treeItem.type === "layer") {
			if (currentLayerType === "group") {
				return treeItem.isExpanded ? (
					<FolderOpen className="w-4 h-4" />
				) : (
					<Folder className="w-4 h-4" />
				);
			}
			return <Layers className="w-4 h-4" />;
		} else {
			// artObject
			return <FileImage className="w-4 h-4" />;
		}
	};

	return (
		<div ref={setNodeRef} style={style}>
			{/* メイン行 */}
			<div
				className={`
          flex items-center min-h-[32px] px-2 py-1 hover:bg-accent/50 rounded-md cursor-pointer
          ${isActive ? "bg-accent" : ""}
          ${isDraggedOver ? "bg-secondary/50" : ""}
        `}
				onClick={(e) => {
					e.stopPropagation();
					onSetActive(treeItem.id, treeItem.type);
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
							e.stopPropagation();
							onToggleExpanded(treeItem.id, treeItem.type);
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
						treeItem.type === "artObject" ? "text-muted-foreground" : ""
					}`}
					{...listeners}
					style={{ cursor: "grab" }}
				>
					{treeItem.name}
				</span>

				{/* 不透明度表示（レイヤーのみ） */}
				{treeItem.type === "layer" && (
					<span className="text-xs text-muted-foreground mr-2">
						{Math.round(currentOpacity * 100)}%
					</span>
				)}

				{/* 表示/非表示ボタン */}
				<Button
					variant="ghost"
					size="sm"
					onClick={(e) => {
						e.stopPropagation();
						onVisibilityToggle(treeItem.id, treeItem.type);
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
							e.stopPropagation();
							onRemove(treeItem.id, treeItem.type);
						}}
						className="w-6 h-6 p-0 ml-1 opacity-60 hover:opacity-100 hover:text-destructive"
					>
						<Trash2 className="w-3 h-3" />
					</Button>
				)}
			</div>

			{/* 透明度スライダー（レイヤーの場合のみ表示） */}
			{treeItem.type === "layer" && (
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
	);
};

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
));

export const LayerPanel = memo(() => {
	const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
	const [overId, setOverId] = useState<UniqueIdentifier | null>(null);

	const document = getActiveDocument();
	const extendedTree = document ? getExtendedTree(document) : [];

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const measuring = {
		droppable: {
			strategy: MeasuringStrategy.Always,
		},
	};

	const customCollisionDetection = useEventCallback((args) => {
		const pointerIntersections = pointerWithin(args);
		const intersections =
			pointerIntersections.length > 0
				? pointerIntersections
				: rectIntersection(args);

		let overId = getFirstCollision(intersections, "id");

		if (overId != null) {
			const overItem = extendedTree.find((item) => item.id === overId);
			if (
				overItem?.type === "layer" &&
				overItem.layer?.type === "group" &&
				overItem.isExpanded
			) {
				const childIds = extendedTree
					.filter(
						(item) => item.type === "layer" && item.parentLayerId === overId,
					)
					.map((item) => item.id);

				const childIntersections = intersections.filter((intersection) =>
					childIds.includes(intersection.id as string),
				);

				if (childIntersections.length > 0) {
					overId = getFirstCollision(childIntersections, "id");
				}
			}
		}

		return overId ? [{ id: overId }] : [];
	});

	const handleDragStart = useEventCallback((event: DragStartEvent) => {
		setActiveId(event.active.id);
	});

	const handleDragOver = useEventCallback((event: DragOverEvent) => {
		setOverId(event.over?.id ?? null);
	});

	const handleDragEnd = useEventCallback((event: DragEndEvent) => {
		const { active, over } = event;
		setActiveId(null);
		setOverId(null);

		if (!over || active.id === over.id) return;

		const activeId = active.id as string;
		const overId = over.id as string;

		const activeItem = extendedTree.find((item) => item.id === activeId);
		const overItem = extendedTree.find((item) => item.id === overId);

		const document = getActiveDocument();
		if (!document) return;

		// Handle drop zones (with position prefixes)
		if (overId.includes("-")) {
			const [position, targetId] = overId.split("-");
			const targetItem = extendedTree.find((item) => item.id === targetId);

			if (position === "inside" && targetItem?.type === "layer") {
				if (activeItem?.type === "layer") {
					// Layer to group/layer
					if (targetItem.layer?.type === "group") {
						moveLayerToGroup(document, activeId, targetId);
					}
				} else if (activeItem?.type === "artObject") {
					// ArtObject to layer
					moveArtObjectToLayer(document, activeId, targetId);
				}
			} else if (position === "before" || position === "after") {
				// Handle reordering
				if (activeItem?.type === "layer" && targetItem?.type === "layer") {
					// Get only layer items for reordering
					const layerItems = extendedTree.filter(
						(item) => item.type === "layer",
					);
					const activeIndex = layerItems.findIndex(
						(item) => item.id === activeId,
					);
					const targetIndex = layerItems.findIndex(
						(item) => item.id === targetId,
					);

					if (activeIndex !== -1 && targetIndex !== -1) {
						const newIndex =
							position === "before" ? targetIndex : targetIndex + 1;

						// Create new order array
						const reorderedItems = [...layerItems];
						const [movedItem] = reorderedItems.splice(activeIndex, 1);
						reorderedItems.splice(
							newIndex > activeIndex ? newIndex - 1 : newIndex,
							0,
							movedItem,
						);

						// Update layer order in document
						reorderedItems.forEach((item, index) => {
							const node = document.layerNodes.find(
								(n) => n.layerId === item.id,
							);
							if (node) {
								node.order = index;
							}
						});

						document.updatedAt = new Date();
					}
				}
			}
		} else {
			// Handle direct item drops (simple reordering)
			if (
				activeItem &&
				overItem &&
				activeItem.type === "layer" &&
				overItem.type === "layer"
			) {
				// Get only layer items for reordering
				const layerItems = extendedTree.filter((item) => item.type === "layer");
				const activeIndex = layerItems.findIndex(
					(item) => item.id === activeId,
				);
				const overIndex = layerItems.findIndex((item) => item.id === overId);

				if (
					activeIndex !== -1 &&
					overIndex !== -1 &&
					activeIndex !== overIndex
				) {
					const reorderedItems = arrayMove(layerItems, activeIndex, overIndex);

					// Update layer order in document
					reorderedItems.forEach((item, index) => {
						const node = document.layerNodes.find((n) => n.layerId === item.id);
						if (node) {
							node.order = index;
						}
					});

					document.updatedAt = new Date();
				} else if (overItem.layer?.type === "group" && overItem.isExpanded) {
					// Move to group
					moveLayerToGroup(document, activeId, overItem.id);
				}
			} else if (
				activeItem?.type === "artObject" &&
				overItem?.type === "layer"
			) {
				// ArtObject to layer movement
				moveArtObjectToLayer(document, activeId, overItem.id);
			} else if (
				activeItem?.type === "artObject" &&
				overItem?.type === "artObject"
			) {
				// ArtObject to same layer as another artObject
				if (overItem.parentLayerId) {
					moveArtObjectToLayer(document, activeId, overItem.parentLayerId);
				}
			}
		}
	});

	const handleAddLayer = useEventCallback(() => {
		const document = getActiveDocument();
		if (document) {
			const layerCount = Object.keys(document.layers).length;
			const layer = createVectorLayer({ name: `レイヤー ${layerCount + 1}` });
			addLayerToDocument(document, layer);
		}
	});

	const handleAddGroupLayer = useEventCallback(() => {
		const document = getActiveDocument();
		if (document) {
			const groupCount = Object.values(document.layers).filter(
				(l) => l.type === "group",
			).length;
			const layer = createGroupLayer({ name: `グループ ${groupCount + 1}` });
			addLayerToDocument(document, layer);
		}
	});

	const _handleLayerVisibilityToggle = useEventCallback((layerId: string) => {
		toggleLayerVisibility(layerId);
	});

	const _handleSetActiveLayer = useEventCallback((layerId: string) => {
		setActiveLayer(layerId);
	});

	const _handleSetLayerOpacity = useEventCallback(
		(layerId: string, opacity: number) => {
			setLayerOpacity(layerId, opacity);
		},
	);

	const _handleRemoveLayer = useEventCallback((layerId: string) => {
		const document = getActiveDocument();
		if (document) {
			removeLayerFromDocument(document, layerId);
		}
	});

	const _handleToggleExpanded = useEventCallback((layerId: string) => {
		const document = getActiveDocument();
		if (document) {
			toggleGroupExpanded(document, layerId);
		}
	});

	// 拡張ツリー用ハンドラー
	const handleExtendedVisibilityToggle = useEventCallback(
		(id: string, type: "layer" | "artObject") => {
			if (type === "layer") {
				toggleLayerVisibility(id);
			} else {
				// artObjectの表示/非表示切り替え
				const document = getActiveDocument();
				if (document) {
					const artObject = document.artObjects[id];
					if (artObject) {
						artObject.visible = !artObject.visible;
					}
				}
			}
		},
	);

	const handleExtendedSetActive = useEventCallback(
		(id: string, type: "layer" | "artObject") => {
			if (type === "layer") {
				setActiveLayer(id);
			} else {
				// artObjectの選択（将来の拡張用）
				console.log("ArtObject selected:", id);
			}
		},
	);

	const handleExtendedRemove = useEventCallback(
		(id: string, type: "layer" | "artObject") => {
			const document = getActiveDocument();
			if (!document) return;

			if (type === "layer") {
				removeLayerFromDocument(document, id);
			} else {
				removeArtObjectFromDocument(document, id);
			}
		},
	);

	const handleExtendedOpacityChange = useEventCallback(
		(id: string, opacity: number, type: "layer" | "artObject") => {
			if (type === "layer") {
				setLayerOpacity(id, opacity);
			} else {
				// artObjectの不透明度変更（将来の拡張用）
				console.log("ArtObject opacity change:", id, opacity);
			}
		},
	);

	const handleExtendedToggleExpanded = useEventCallback(
		(id: string, type: "layer" | "artObject") => {
			const document = getActiveDocument();
			if (!document || type !== "layer") return;

			const treeItem = extendedTree.find(
				(item) => item.id === id && item.type === "layer",
			);
			if (treeItem?.layer?.type === "group") {
				toggleGroupExpanded(document, id);
			} else {
				toggleLayerArtObjectsExpanded(document, id);
			}
		},
	);

	const activeLayer =
		activeId && document ? document.layers[activeId as string] : null;

	return (
		<div data-testid="layer-panel">
			<div className="flex gap-2 items-center justify-between">
				<h3 className="text-xs font-semibold">レイヤー</h3>
				<div className="flex space-x-2">
					<Button size="xs" onClick={handleAddLayer}>
						<Plus className="w-4 h-4" />
						レイヤー
					</Button>
					<Button size="xs" variant="outline" onClick={handleAddGroupLayer}>
						<Folder className="w-4 h-4" />
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
										treeItem.type === "layer" &&
										treeItem.id === document?.activeLayerId
									}
									onVisibilityToggle={handleExtendedVisibilityToggle}
									onSetActive={handleExtendedSetActive}
									onRemove={handleExtendedRemove}
									onOpacityChange={handleExtendedOpacityChange}
									onToggleExpanded={handleExtendedToggleExpanded}
									canDelete={
										treeItem.type === "layer"
											? Object.keys(document?.layers || {}).length > 1
											: true
									}
									isDraggedOver={
										overId === treeItem.id || overId === `inside-${treeItem.id}`
									}
								/>

								{/* ドロップゾーン: グループ内 */}
								{treeItem.type === "layer" &&
									document?.layers[treeItem.id]?.type === "group" &&
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
	);
});

LayerPanel.displayName = "LayerPanel";
