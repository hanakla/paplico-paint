"use client";

import { useEventCallback } from "@paplico/shared-lib/react";
import {
	Brush,
	Bug,
	Download,
	Eraser,
	Filter,
	Hand,
	Keyboard,
	Layers,
	MousePointer,
	Move,
	Pipette,
	Redo,
	Settings,
	Target,
	Undo,
	ZoomIn,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ref, snapshot, useSnapshot } from "valtio";
import { ColorSlider } from "@/components/color-slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExportDialog } from "@/dialogs/ExportDialog";
import { KeyboardShortcutsDialog } from "@/dialogs/KeyboardShortcutsDialog";
import { PaplicoEngine } from "@/engine/paplico";
import {
	clearSelection,
	deleteSelected,
	selectionState,
	selectionTool,
	setSelectionMode,
	updateSelectionTool,
} from "@/engine/selection-state";
import { UIBuilder } from "@/engine/webgpu/ui/ui-elements";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useNullishSnapshot } from "@/lib/hooks";
import {
	canRedo,
	canUndo,
	editorState,
	redo,
	setEngine,
	setWebGPUSupported,
	undo,
} from "@/stores/editor";
import { useUIStore } from "@/stores/ui-store";
import { debugLogger } from "@/utils/debug-logger";
import { createTestDocument } from "./_example";
import { DebugPane } from "./fragments/DebugPane";
import { LayerPanel } from "./fragments/LayerPanel";

const toolIcons = {
	brush: Brush,
	eraser: Eraser,
	select: MousePointer,
	move: Move,
	vertexSelect: Target,
	pan: Hand,
	zoom: ZoomIn,
	eyedropper: Pipette,
};

const toolNames = {
	brush: "ブラシ",
	eraser: "消しゴム",
	select: "選択・移動",
	move: "移動",
	vertexSelect: "頂点選択",
	pan: "パン",
	zoom: "ズーム",
	eyedropper: "スポイト",
};

export default function Home() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const canvasContainerRef = useRef<HTMLDivElement>(null);
	const engineRef = useRef<PaplicoEngine | null>(null);
	const animationFrameRef = useRef<number | undefined>(undefined);

	const [_isWebGPUSupported, setIsWebGPUSupported] = useState(false);
	const [_isInitialized, setIsInitialized] = useState(false);
	const [_isDrawing, _setIsDrawing] = useState(false);
	const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);

	const engineStateSnap = useNullishSnapshot(
		engineRef.current?.getEngineState(),
	);
	const editorSnap = useSnapshot(editorState);
	const {
		selectedTool,
		layersPanelOpen,
		brushPanelOpen,
		filtersPanelOpen,
		debugPanelOpen,
		selectedColor,
		brushSize,
		brushOpacity,
		shortcuts,
		setSelectedTool,
		toggleLayersPanel,
		toggleBrushPanel,
		toggleFiltersPanel,
		toggleDebugPanel,
		setSelectedColor,
		setBrushSize,
		setBrushOpacity,
	} = useUIStore();

	const hexToColor = (hex: string) => {
		const r = parseInt(hex.slice(1, 3), 16) / 255;
		const g = parseInt(hex.slice(3, 5), 16) / 255;
		const b = parseInt(hex.slice(5, 7), 16) / 255;
		return { r, g, b, a: brushOpacity / 100 };
	};

	const initializeWebGPU = useEventCallback(async () => {
		console.log("[DEBUG] initializeWebGPU called");
		const canvas = canvasRef.current;
		if (!canvas) return;

		try {
			if (!navigator.gpu) {
				console.log("[DEBUG] WebGPU not supported");
				setIsWebGPUSupported(false);
				return;
			}

			console.log("[DEBUG] Creating PaplicoEngine");
			const paplicoEngine = new PaplicoEngine(canvas);
			const success = await paplicoEngine.initialize();
			console.log("[DEBUG] PaplicoEngine initialization result:", success);

			if (success) {
				engineRef.current = paplicoEngine;
				setEngine(ref(paplicoEngine));
				setWebGPUSupported(true);
				setIsWebGPUSupported(true);
				setIsInitialized(true);
				// 初期キャンバスサイズを設定
				const rect = canvas.getBoundingClientRect();
				paplicoEngine.resize(rect.width, rect.height);
				// PaplicoEngineは自動的に入力を処理し、レンダーループも実行されます
				// テスト用ドキュメントを作成・設定
				console.log("[DEBUG] Creating test document");
				paplicoEngine.documentManager.loadDocument(createTestDocument());
				// const documentId = paplicoEngine.documentManager.createDocument({ name: 'テストドキュメント' })
				// console.log('[DEBUG] Test document created with ID:', documentId)
				// 初期キャンバスサイズを設定
				handleCanvasResize();
				console.log("[DEBUG] WebGPU initialization completed successfully");
			} else {
				console.log("[DEBUG] PaplicoEngine initialization failed");
				setWebGPUSupported(false);
				setIsWebGPUSupported(false);
			}
		} catch (error) {
			console.error("[DEBUG] WebGPU initialization error:", error);
			setWebGPUSupported(false);
			setIsWebGPUSupported(false);
		}
	});

	const handleCanvasResize = useEventCallback(() => {
		const container = canvasContainerRef.current;
		const canvas = canvasRef.current;
		if (!container || !canvas || !engineRef.current) return;

		const rect = container.getBoundingClientRect();
		// キャンバスのDOM要素自体のサイズも更新
		canvas.style.width = `${rect.width}px`;
		canvas.style.height = `${rect.height}px`;
		engineRef.current.resize(rect.width, rect.height);
	});

	const handleToolSelect = useEventCallback((toolId: string) => {
		setSelectedTool(toolId);
		engineRef.current?.setActiveTool(toolId as any);
	});

	const handleBrushSizeChange = useEventCallback((value: number[]) => {
		setBrushSize(value[0]);
		engineRef.current?.setBrushConfig({ size: value[0] });
	});

	const handleBrushOpacityChange = useEventCallback((value: number[]) => {
		setBrushOpacity(value[0]);
		engineRef.current?.setBrushConfig({
			color: hexToColor(selectedColor),
		});
	});

	const handleColorChange = useEventCallback((color: string) => {
		setSelectedColor(color);
		engineRef.current?.setBrushConfig({
			color: hexToColor(color),
		});
	});

	const rgbaToHex = (rgba: { r: number; g: number; b: number; a: number }) => {
		const r = Math.round(rgba.r * 255)
			.toString(16)
			.padStart(2, "0");
		const g = Math.round(rgba.g * 255)
			.toString(16)
			.padStart(2, "0");
		const b = Math.round(rgba.b * 255)
			.toString(16)
			.padStart(2, "0");
		return `#${r}${g}${b}`;
	};

	const handleColorSliderChange = useEventCallback(
		(color: { r: number; g: number; b: number; a: number }) => {
			handleColorChange(rgbaToHex(color));
		},
	);

	const handleResize = useEventCallback(() => handleCanvasResize());

	// 選択・移動ツール用の状態
	const selectionSnap = useSnapshot(selectionState);
	const selectionToolSnap = useSnapshot(selectionTool);

	// 選択ツールのUIを更新
	const updateSelectionUI = useEventCallback(() => {
		if (!engineRef.current) return;

		const uiBuilder = new UIBuilder();

		// グリッド表示（簡易版）
		if (selectionToolSnap.snapToGrid) {
			// TODO: グリッド表示は今後実装
		}

		// 選択されたオブジェクトのバウンディングボックス
		if (selectionSnap.boundingBox && selectionSnap.selectedObjects.size > 0) {
			uiBuilder.surface({
				id: "selection-box",
				position: "local",
				location: {
					x: selectionSnap.boundingBox.x,
					y: selectionSnap.boundingBox.y,
				},
				size: {
					width: selectionSnap.boundingBox.width,
					height: selectionSnap.boundingBox.height,
				},
				borderColor: { r: 0.2, g: 0.6, b: 1.0, a: 1.0 },
				borderWidth: 2,
				fillMode: "stroke",
				zIndex: 1000,
			});
		}

		// 選択された頂点を表示
		if (selectionSnap.selectionMode === "vertex") {
			// TODO: pathVerticesから選択された頂点を描画
			// 実装は後続で詳細化
		}

		// UIRendererに設定（実際の実装ではengineRef.current.uiRenderer.setUI(uiBuilder)）
		// 現在は仮実装
		console.log("Selection UI updated:", uiBuilder.build());
	});

	// 選択状態の変更時にUIを更新
	useEffect(() => {
		updateSelectionUI();
	}, [updateSelectionUI]);

	// 選択ツール設定の変更
	const handleSelectionModeChange = useEventCallback(
		(mode: "object" | "vertex") => {
			setSelectionMode(mode);
			if (mode === "vertex") {
				setSelectedTool("vertexSelect");
			} else {
				setSelectedTool("select");
			}
		},
	);

	const handleSnapToGridToggle = useEventCallback((enabled: boolean) => {
		updateSelectionTool({ snapToGrid: enabled });
	});

	const handleShowHandlesToggle = useEventCallback((enabled: boolean) => {
		updateSelectionTool({ showHandles: enabled });
	});

	// キーボードショートカットの設定
	useKeyboardShortcuts({
		onToolChange: (toolId) => {
			engineRef.current?.setActiveTool(toolId as any);
		},
		onDelete: () => {
			deleteSelected();
		},
		onUndo: () => {
			undo();
		},
		onRedo: () => {
			redo();
		},
	});

	useEffect(() => {
		// デバッグ用
		Object.defineProperty(window, "_es", {
			configurable: true,
			get: () => snapshot(editorState),
		});

		debugLogger.clear().then(() => {
			initializeWebGPU().catch((e) => {
				console.error("WebGPU initialization failed:", e);
			});
		});

		window.addEventListener("resize", handleResize);

		// ResizeObserverを使用してcanvasコンテナのサイズ変更を監視
		let resizeObserver: ResizeObserver | null = null;
		const container = canvasContainerRef.current;
		if (container) {
			resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					if (entry.target === container) {
						handleCanvasResize();
					}
				}
			});
			resizeObserver.observe(container);
		}

		return () => {
			window.removeEventListener("resize", handleResize);
			if (resizeObserver && container) {
				resizeObserver.unobserve(container);
				resizeObserver.disconnect();
			}
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
			if (engineRef.current) {
				engineRef.current.dispose();
			}
		};
	}, [handleCanvasResize, handleResize, initializeWebGPU]);

	useEffect(() => {
		handleCanvasResize();
	}, [handleCanvasResize]);

	return (
		<div className="flex h-screen w-screen bg-background overflow-hidden">
			{/* ツールバー */}
			<div className="w-16 bg-card border-r flex flex-col items-center py-4 space-y-2">
				{Object.entries(toolIcons).map(([toolId, Icon]) => {
					const shortcutKey = shortcuts[toolId as keyof typeof shortcuts];
					const toolName = toolNames[toolId as keyof typeof toolNames];

					return (
						<Tooltip key={toolId}>
							<TooltipTrigger asChild>
								<Button
									variant={selectedTool === toolId ? "default" : "outline"}
									size="icon"
									onClick={() => handleToolSelect(toolId)}
									className="w-10 h-10"
								>
									<Icon className="w-4 h-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="right">
								<div className="text-center">
									<div className="font-medium">{toolName}</div>
									{shortcutKey && (
										<div className="text-xs opacity-75 mt-1">
											{shortcutKey.toUpperCase()}
										</div>
									)}
								</div>
							</TooltipContent>
						</Tooltip>
					);
				})}

				<Separator className="my-2" />

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={layersPanelOpen ? "default" : "outline"}
							size="icon"
							onClick={toggleLayersPanel}
							className="w-10 h-10"
						>
							<Layers className="w-4 h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right">レイヤーパネル</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={brushPanelOpen ? "default" : "outline"}
							size="icon"
							onClick={toggleBrushPanel}
							className="w-10 h-10"
						>
							<Settings className="w-4 h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right">ブラシ設定</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={filtersPanelOpen ? "default" : "outline"}
							size="icon"
							onClick={toggleFiltersPanel}
							className="w-10 h-10"
						>
							<Filter className="w-4 h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right">フィルター</TooltipContent>
				</Tooltip>
			</div>

			{/* メインキャンバス */}
			<div className="flex-1 flex flex-col min-w-0">
				{/* トップバー */}
				<div className="bg-card border-b px-4 py-2 overflow-x-auto flex-shrink-0">
					<div className="flex items-center space-x-4 min-w-max">
						{!editorSnap.isWebGPUSupported && (
							<Badge variant="destructive">WebGPU: 未サポート</Badge>
						)}
						<Badge variant={editorSnap.isInitialized ? "default" : "secondary"}>
							エンジン: {editorSnap.isInitialized ? "初期化完了" : "初期化中"}
						</Badge>
						<Badge variant="outline">
							FPS: {Math.round(engineStateSnap?.performance?.fps || 0)}
						</Badge>
						<div className="flex items-center space-x-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => undo()}
								disabled={!canUndo()}
							>
								<Undo className="w-4 h-4 mr-1" />
								アンドゥ
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => redo()}
								disabled={!canRedo()}
							>
								<Redo className="w-4 h-4 mr-1" />
								リドゥ
							</Button>
							{engineStateSnap?.document?.artboards &&
								engineRef.current &&
								(() => {
									const documentContext =
										engineRef.current.getActiveDocumentContext();
									return (
										documentContext && (
											<ExportDialog
												artboards={engineStateSnap.document.artboards}
												documentContext={documentContext}
												webgpuEngine={engineRef.current.getEngine()}
											>
												<Button variant="outline" size="sm">
													<Download className="w-4 h-4 mr-1" />
													エクスポート
												</Button>
											</ExportDialog>
										)
									);
								})()}{" "}
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									// 選択モード切り替え
									const newMode =
										selectionSnap.selectionMode === "object"
											? "vertex"
											: "object";
									handleSelectionModeChange(newMode);
								}}
							>
								<Target className="w-4 h-4 mr-1" />
								{selectionSnap.selectionMode === "object"
									? "オブジェクト選択"
									: "頂点選択"}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => clearSelection()}
							>
								選択解除
							</Button>
						</div>

						<Separator orientation="vertical" className="h-6" />

						<div className="flex items-center space-x-2">
							<Label className="text-sm">色:</Label>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className="w-8 h-8 p-0 border border-border rounded cursor-pointer"
										style={{ backgroundColor: selectedColor }}
									/>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-3">
									<ColorSlider
										value={hexToColor(selectedColor)}
										onChange={handleColorSliderChange}
									/>
								</PopoverContent>
							</Popover>
						</div>

						<Separator orientation="vertical" className="h-6" />

						<div className="flex items-center space-x-2">
							<Label className="text-sm">サイズ: {brushSize}px</Label>
							<Slider
								value={[brushSize]}
								onValueChange={handleBrushSizeChange}
								max={100}
								min={1}
								step={1}
								className="w-24"
							/>
						</div>

						<Button
							variant={debugPanelOpen ? "default" : "outline"}
							size="sm"
							onClick={toggleDebugPanel}
							className="flex items-center space-x-2"
						>
							<Bug className="w-4 h-4" />
						</Button>

						<Button
							variant="outline"
							size="sm"
							onClick={() => setShortcutsDialogOpen(true)}
							className="flex items-center gap-2"
						>
							<Keyboard className="w-4 h-4" />
							ショートカット
						</Button>
					</div>
				</div>

				{/* キャンバス */}
				<div
					ref={canvasContainerRef}
					className="flex-1 relative bg-muted overflow-hidden"
				>
					<canvas
						ref={canvasRef}
						className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
					/>
				</div>
			</div>

			{/* サイドパネル */}
			<div className="w-72 bg-card border-l flex-none">
				<Tabs defaultValue="layers" className="h-full flex flex-col">
					<TabsList className="grid w-full grid-cols-4">
						<TabsTrigger value="layers">レイヤー</TabsTrigger>
						<TabsTrigger value="brush">ブラシ</TabsTrigger>
						<TabsTrigger value="selection">選択</TabsTrigger>
						<TabsTrigger value="filters">フィルター</TabsTrigger>
					</TabsList>

					<div className="flex-1 overflow-y-auto !p-0">
						{/* レイヤーパネル */}
						<TabsContent asChild value="layers" className="space-y-4 mt-0 !p-0">
							<LayerPanel />
						</TabsContent>

						{/* ブラシパネル */}
						<TabsContent value="brush" className="space-y-4 mt-0">
							<h3 className="text-lg font-semibold">ブラシ設定</h3>

							<Card>
								<CardHeader>
									<CardTitle className="text-base">基本設定</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div>
										<Label>サイズ: {brushSize}px</Label>
										<Slider
											value={[brushSize]}
											onValueChange={handleBrushSizeChange}
											max={100}
											min={1}
											step={1}
											className="mt-2"
										/>
									</div>

									<div>
										<Label>不透明度: {brushOpacity}%</Label>
										<Slider
											value={[brushOpacity]}
											onValueChange={handleBrushOpacityChange}
											max={100}
											min={0}
											step={1}
											className="mt-2"
										/>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-base">散布設定</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div>
										<Label>個数</Label>
										<Slider
											value={[
												engineStateSnap?.strokeSettings.brushSettings
													?.scatterConfig?.count || 5,
											]}
											onValueChange={(value) =>
												engineRef.current?.setBrushConfig({
													scatterConfig: {
														count: value[0],
														spread:
															engineStateSnap?.strokeSettings.brushSettings
																?.scatterConfig?.spread || 10,
														sizeVariation:
															engineStateSnap?.strokeSettings.brushSettings
																?.scatterConfig?.sizeVariation || 0.2,
														opacityVariation:
															engineStateSnap?.strokeSettings.brushSettings
																?.scatterConfig?.opacityVariation || 0.1,
													},
												})
											}
											max={20}
											min={1}
											step={1}
											className="mt-2"
										/>
									</div>

									<div>
										<Label>散布範囲</Label>
										<Slider
											value={[
												engineStateSnap?.strokeSettings.brushSettings
													?.scatterConfig?.spread || 10,
											]}
											onValueChange={(value) =>
												engineRef.current?.setBrushConfig({
													scatterConfig: {
														count:
															engineStateSnap?.strokeSettings.brushSettings
																?.scatterConfig?.count || 5,
														spread: value[0],
														sizeVariation:
															engineStateSnap?.strokeSettings.brushSettings
																?.scatterConfig?.sizeVariation || 0.2,
														opacityVariation:
															engineStateSnap?.strokeSettings.brushSettings
																?.scatterConfig?.opacityVariation || 0.1,
													},
												})
											}
											max={50}
											min={1}
											step={1}
											className="mt-2"
										/>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-base">ストローク設定</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div>
										<Label>ブラシテクスチャ</Label>
										<div className="grid grid-cols-2 gap-2 mt-2">
											<Button
												variant={
													engineStateSnap?.strokeSettings.brushSettings
														?.texture === "pencil"
														? "default"
														: "outline"
												}
												size="sm"
												onClick={() =>
													engineRef.current?.setBrushConfig({
														strokeSettings: {
															texture: "pencil",
															scatterRange:
																engineStateSnap?.strokeSettings.brushSettings
																	?.scatterConfig?.spread || 0.5,
															rotationAdjust:
																engineStateSnap?.strokeSettings.brushSettings
																	?.rotationAdjust || 1,
															randomRotation:
																engineStateSnap?.strokeSettings.brushSettings
																	?.randomRotation || 0,
															randomScale:
																engineStateSnap?.strokeSettings.brushSettings
																	?.randomScale || 0,
															inOutInfluence:
																engineStateSnap?.strokeSettings.brushSettings
																	?.inOutInfluence || 1,
															inOutLength:
																engineStateSnap?.strokeSettings.brushSettings
																	?.inOutLength || 100,
															divisions:
																engineStateSnap?.strokeSettings.brushSettings
																	?.divisions || 1000,
															pressureInfluence:
																engineStateSnap?.strokeSettings.brushSettings
																	?.pressureInfluence || 0.8,
															noiseInfluence:
																engineStateSnap?.strokeSettings.brushSettings
																	?.noiseInfluence || 0,
														},
													})
												}
											>
												鉛筆
											</Button>
											<Button
												variant={
													engineStateSnap?.strokeSettings.strokeSettings
														?.texture === "airbrush"
														? "default"
														: "outline"
												}
												size="sm"
												onClick={() =>
													engineRef.current?.setBrushConfig({
														strokeSettings: {
															texture: "airbrush",
															scatterRange:
																engineStateSnap?.strokeSettings.strokeSettings
																	?.scatterRange || 0.5,
															rotationAdjust:
																engineStateSnap?.strokeSettings.strokeSettings
																	?.rotationAdjust || 1,
															randomRotation:
																engineStateSnap?.strokeSettings.strokeSettings
																	?.randomRotation || 0,
															randomScale:
																engineStateSnap?.strokeSettings.strokeSettings
																	?.randomScale || 0,
															inOutInfluence:
																engineStateSnap?.strokeSettings.strokeSettings
																	?.inOutInfluence || 1,
															inOutLength:
																engineStateSnap?.strokeSettings.strokeSettings
																	?.inOutLength || 100,
															divisions:
																engineStateSnap?.strokeSettings.strokeSettings
																	?.divisions || 1000,
															pressureInfluence:
																engineStateSnap?.strokeSettings.strokeSettings
																	?.pressureInfluence || 0.8,
															noiseInfluence:
																engineStateSnap?.strokeSettings.strokeSettings
																	?.noiseInfluence || 0,
														},
													})
												}
											>
												エアブラシ
											</Button>
										</div>
									</div>

									<div>
										<Label>
											スキャッター範囲:{" "}
											{engineStateSnap?.strokeSettings.brushSettings
												?.scatterConfig?.spread || 0.5}
										</Label>
										<Slider
											value={[
												engineStateSnap?.strokeSettings.brushSettings
													?.scatterConfig?.spread || 0.5,
											]}
											onValueChange={(value) =>
												engineRef.current?.setBrushConfig({
													strokeSettings: {
														texture:
															engineStateSnap?.strokeSettings.brushSettings
																?.texture || "pencil",
														scatterRange: value[0],
														rotationAdjust:
															engineStateSnap?.strokeSettings.brushSettings
																?.rotationAdjust || 1,
														randomRotation:
															engineStateSnap?.strokeSettings.brushSettings
																?.randomRotation || 0,
														randomScale:
															engineStateSnap?.strokeSettings.brushSettings
																?.randomScale || 0,
														inOutInfluence:
															engineStateSnap?.strokeSettings.brushSettings
																?.inOutInfluence || 1,
														inOutLength:
															engineStateSnap?.strokeSettings.brushSettings
																?.inOutLength || 100,
														divisions:
															engineStateSnap?.strokeSettings.brushSettings
																?.divisions || 1000,
														pressureInfluence:
															engineStateSnap?.strokeSettings.brushSettings
																?.pressureInfluence || 0.8,
														noiseInfluence:
															engineStateSnap?.strokeSettings.brushSettings
																?.noiseInfluence || 0,
													},
												})
											}
											max={2}
											min={0}
											step={0.1}
											className="mt-2"
										/>
									</div>

									<div>
										<Label>
											ランダム回転:{" "}
											{engineStateSnap?.strokeSettings.brushSettings
												?.randomRotation || 0}
										</Label>
										<Slider
											value={[
												engineStateSnap?.strokeSettings.brushSettings
													?.randomRotation || 0,
											]}
											onValueChange={(value) =>
												engineRef.current?.setBrushConfig({
													strokeSettings: {
														texture:
															engineStateSnap?.strokeSettings.brushSettings
																?.texture || "pencil",
														scatterRange:
															engineStateSnap?.strokeSettings.brushSettings
																?.scatterConfig?.spread || 0.5,
														rotationAdjust:
															engineStateSnap?.strokeSettings.brushSettings
																?.rotationAdjust || 1,
														randomRotation: value[0],
														randomScale:
															engineStateSnap?.strokeSettings.brushSettings
																?.randomScale || 0,
														inOutInfluence:
															engineStateSnap?.strokeSettings.brushSettings
																?.inOutInfluence || 1,
														inOutLength:
															engineStateSnap?.strokeSettings.brushSettings
																?.inOutLength || 100,
														divisions:
															engineStateSnap?.strokeSettings.brushSettings
																?.divisions || 1000,
														pressureInfluence:
															engineStateSnap?.strokeSettings.brushSettings
																?.pressureInfluence || 0.8,
														noiseInfluence:
															engineStateSnap?.strokeSettings.brushSettings
																?.noiseInfluence || 0,
													},
												})
											}
											max={1}
											min={0}
											step={0.1}
											className="mt-2"
										/>
									</div>

									<div>
										<Label>
											ランダムスケール:{" "}
											{engineStateSnap?.strokeSettings.brushSettings
												?.randomScale || 0}
										</Label>
										<Slider
											value={[
												engineStateSnap?.strokeSettings.brushSettings
													?.randomScale || 0,
											]}
											onValueChange={(value) =>
												engineRef.current?.setBrushConfig({
													strokeSettings: {
														texture:
															engineStateSnap?.strokeSettings.brushSettings
																?.texture || "pencil",
														scatterRange:
															engineStateSnap?.strokeSettings.brushSettings
																?.scatterRange || 0.5,
														rotationAdjust:
															engineStateSnap?.strokeSettings.brushSettings
																?.rotationAdjust || 1,
														randomRotation:
															engineStateSnap?.strokeSettings.brushSettings
																?.randomRotation || 0,
														randomScale: value[0],
														inOutInfluence:
															engineStateSnap?.strokeSettings.brushSettings
																?.inOutInfluence || 1,
														inOutLength:
															engineStateSnap?.strokeSettings.brushSettings
																?.inOutLength || 100,
														divisions:
															engineStateSnap?.strokeSettings.brushSettings
																?.divisions || 1000,
														pressureInfluence:
															engineStateSnap?.strokeSettings.brushSettings
																?.pressureInfluence || 0.8,
														noiseInfluence:
															engineStateSnap?.strokeSettings.brushSettings
																?.noiseInfluence || 0,
													},
												})
											}
											max={1}
											min={0}
											step={0.1}
											className="mt-2"
										/>
									</div>

									<div>
										<Label>
											インアウト効果:{" "}
											{engineStateSnap?.strokeSettings.strokeSettings
												?.inOutInfluence || 1}
										</Label>
										<Slider
											value={[
												engineStateSnap?.strokeSettings.strokeSettings
													?.inOutInfluence || 1,
											]}
											onValueChange={(value) =>
												engineRef.current?.setBrushConfig({
													strokeSettings: {
														texture:
															engineStateSnap?.strokeSettings.brushSettings
																?.texture || "pencil",
														scatterRange:
															engineStateSnap?.strokeSettings.brushSettings
																?.scatterRange || 0.5,
														rotationAdjust:
															engineStateSnap?.strokeSettings.brushSettings
																?.rotationAdjust || 1,
														randomRotation:
															engineStateSnap?.strokeSettings.brushSettings
																?.randomRotation || 0,
														randomScale:
															engineStateSnap?.strokeSettings.brushSettings
																?.randomScale || 0,
														inOutInfluence: value[0],
														inOutLength:
															engineStateSnap?.strokeSettings.brushSettings
																?.inOutLength || 100,
														divisions:
															engineStateSnap?.strokeSettings.brushSettings
																?.divisions || 1000,
														pressureInfluence:
															engineStateSnap?.strokeSettings.brushSettings
																?.pressureInfluence || 0.8,
														noiseInfluence:
															engineStateSnap?.strokeSettings.brushSettings
																?.noiseInfluence || 0,
													},
												})
											}
											max={1}
											min={0}
											step={0.1}
											className="mt-2"
										/>
									</div>
								</CardContent>
							</Card>
						</TabsContent>

						{/* フィルターパネル */}
						<TabsContent value="filters" className="space-y-4 mt-0">
							<h3 className="text-lg font-semibold">フィルター</h3>

							<div className="space-y-3">
								{["blur", "brightness", "contrast", "saturation", "hue"].map(
									(filterType) => (
										<Card key={filterType}>
											<CardContent className="p-3">
												<div className="flex items-center justify-between mb-2">
													<Label className="capitalize">{filterType}</Label>
													<Switch />
												</div>
												<Slider
													defaultValue={[
														filterType === "blur"
															? 1
															: filterType === "brightness"
																? 0
																: 1,
													]}
													max={
														filterType === "blur"
															? 10
															: filterType === "brightness"
																? 1
																: 2
													}
													min={filterType === "brightness" ? -1 : 0}
													step={0.1}
													className="mt-2"
												/>
											</CardContent>
										</Card>
									),
								)}
							</div>
						</TabsContent>

						{/* 選択ツールパネル */}
						<TabsContent value="selection" className="space-y-4 mt-0">
							<h3 className="text-lg font-semibold">選択・移動ツール</h3>

							<Card>
								<CardHeader>
									<CardTitle className="text-base">選択モード</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center space-x-2">
										<Label>モード:</Label>
										<Badge
											variant={
												selectionSnap.selectionMode === "object"
													? "default"
													: "secondary"
											}
										>
											{selectionSnap.selectionMode === "object"
												? "オブジェクト"
												: "頂点"}
										</Badge>
									</div>

									<div className="flex items-center space-x-2">
										<Switch
											checked={selectionToolSnap.showHandles}
											onCheckedChange={handleShowHandlesToggle}
										/>
										<Label>リサイズハンドル表示</Label>
									</div>

									<div className="flex items-center space-x-2">
										<Switch
											checked={selectionToolSnap.snapToGrid}
											onCheckedChange={handleSnapToGridToggle}
										/>
										<Label>グリッドスナップ</Label>
									</div>

									<div className="flex items-center space-x-2">
										<Switch
											checked={selectionToolSnap.snapToObjects}
											onCheckedChange={(enabled) =>
												updateSelectionTool({ snapToObjects: enabled })
											}
										/>
										<Label>オブジェクトスナップ</Label>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle className="text-base">選択情報</CardTitle>
								</CardHeader>
								<CardContent className="space-y-2">
									<div className="flex justify-between">
										<span>選択オブジェクト数:</span>
										<Badge variant="outline">
											{selectionSnap.selectedObjects.size}
										</Badge>
									</div>
									<div className="flex justify-between">
										<span>選択頂点数:</span>
										<Badge variant="outline">
											{selectionSnap.selectedVertices.size}
										</Badge>
									</div>
									{selectionSnap.boundingBox && (
										<>
											<div className="flex justify-between">
												<span>X:</span>
												<span>{Math.round(selectionSnap.boundingBox.x)}</span>
											</div>
											<div className="flex justify-between">
												<span>Y:</span>
												<span>{Math.round(selectionSnap.boundingBox.y)}</span>
											</div>
											<div className="flex justify-between">
												<span>幅:</span>
												<span>
													{Math.round(selectionSnap.boundingBox.width)}
												</span>
											</div>
											<div className="flex justify-between">
												<span>高さ:</span>
												<span>
													{Math.round(selectionSnap.boundingBox.height)}
												</span>
											</div>
										</>
									)}
								</CardContent>
							</Card>

							{selectionSnap.selectedObjects.size > 0 && (
								<Card>
									<CardHeader>
										<CardTitle className="text-base">変形</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										<Button
											variant="outline"
											size="sm"
											className="w-full"
											onClick={() => {
												// TODO: 複製機能
												console.log("複製");
											}}
										>
											複製
										</Button>
										<Button
											variant="outline"
											size="sm"
											className="w-full"
											onClick={() => {
												deleteSelected();
											}}
										>
											削除
										</Button>
									</CardContent>
								</Card>
							)}
						</TabsContent>
					</div>
				</Tabs>
			</div>

			{/* デバッグペイン（一番右） */}
			{debugPanelOpen && (
				<div className="bg-card flex-none">
					<DebugPane engine={engineRef.current} isOpen={debugPanelOpen} />
				</div>
			)}

			{/* キーボードショートカット設定ダイアログ */}
			<KeyboardShortcutsDialog
				open={shortcutsDialogOpen}
				onOpenChange={setShortcutsDialogOpen}
			/>
		</div>
	);
}
