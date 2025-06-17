'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSnapshot } from 'valtio'
import { useEventCallback } from '@paplico/shared-lib/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Brush,
  Eraser,
  MousePointer,
  Hand,
  ZoomIn,
  Pipette,
  Layers,
  Settings,
  Filter,
  Undo,
  Redo,
  Move,
  Target,
} from 'lucide-react'

import { PaplicoEngine } from '@/engine/paplico'
import {
  engineState,
  setActiveTool,
  setBrushConfig,
  startDrawing,
  endDrawing,
  createVectorPath,
} from '@/engine/state'
import {
  editorState,
  setEngine,
  setWebGPUSupported,
  getActiveDocument,
  undo,
  redo,
  canUndo,
  canRedo,
} from '@/stores/editor'
import {
  selectionState,
  selectionTool,
  clearSelection,
  setSelectionMode,
  updateSelectionTool,
  addTestObjects,
} from '@/engine/selection-state'
import { UIBuilder } from '@/engine/webgpu/ui/ui-renderer'
import { useUIStore } from '@/stores/ui-store'
import { createTestDocument } from './_example'
import { LayerPanel } from './fragments/LayerPanel'

const toolIcons = {
  brush: Brush,
  eraser: Eraser,
  select: MousePointer,
  move: Move,
  vertexSelect: Target,
  pan: Hand,
  zoom: ZoomIn,
  eyedropper: Pipette,
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<PaplicoEngine | null>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)

  const [isWebGPUSupported, setIsWebGPUSupported] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)

  const snap = useSnapshot(engineState)
  const editorSnap = useSnapshot(editorState)
  const {
    selectedTool,
    layersPanelOpen,
    brushPanelOpen,
    filtersPanelOpen,
    selectedColor,
    brushSize,
    brushOpacity,
    setSelectedTool,
    toggleLayersPanel,
    toggleBrushPanel,
    toggleFiltersPanel,
    setSelectedColor,
    setBrushSize,
    setBrushOpacity,
  } = useUIStore()

  const hexToColor = useEventCallback((hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    return { r, g, b, a: brushOpacity / 100 }
  })

  const initializeWebGPU = useEventCallback(async () => {
    console.log('[DEBUG] initializeWebGPU called')
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      if (!navigator.gpu) {
        console.log('[DEBUG] WebGPU not supported')
        setIsWebGPUSupported(false)
        return
      }

      console.log('[DEBUG] Creating PaplicoEngine')
      const paplicoEngine = new PaplicoEngine(canvas)
      const success = await paplicoEngine.initialize()
      console.log('[DEBUG] PaplicoEngine initialization result:', success)

      if (success) {
        // engineRef.current = paplicoEngine
        // setEngine(paplicoEngine)
        // setWebGPUSupported(true)
        // setIsWebGPUSupported(true)
        // setIsInitialized(true)
        // // 初期キャンバスサイズを設定
        // const rect = canvas.getBoundingClientRect()
        // paplicoEngine.resize(rect.width, rect.height)
        // // PaplicoEngineは自動的に入力を処理し、レンダーループも実行されます
        // // テスト用ドキュメントを作成・設定
        // console.log('[DEBUG] Creating test document')
        // const documentId = paplicoEngine.documents.createDocument({ name: 'テストドキュメント' })
        // console.log('[DEBUG] Test document created with ID:', documentId)
        // // 初期キャンバスサイズを設定
        // handleCanvasResize()
        // console.log('[DEBUG] WebGPU initialization completed successfully')
      } else {
        console.log('[DEBUG] PaplicoEngine initialization failed')
        setWebGPUSupported(false)
        setIsWebGPUSupported(false)
      }
    } catch (error) {
      console.error('[DEBUG] WebGPU initialization error:', error)
      setWebGPUSupported(false)
      setIsWebGPUSupported(false)
    }
  })

  const handleCanvasResize = useEventCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !engineRef.current) return

    const rect = canvas.getBoundingClientRect()
    engineRef.current.resize(rect.width, rect.height)
  })

  const handleToolSelect = useEventCallback((toolId: string) => {
    setSelectedTool(toolId)
    setActiveTool(toolId as any)
  })

  const handleBrushSizeChange = useEventCallback((value: number[]) => {
    setBrushSize(value[0])
    setBrushConfig({ size: value[0] })
  })

  const handleBrushOpacityChange = useEventCallback((value: number[]) => {
    setBrushOpacity(value[0])
    setBrushConfig({
      color: hexToColor(selectedColor),
    })
  })

  const handleColorChange = useEventCallback((color: string) => {
    setSelectedColor(color)
    setBrushConfig({
      color: hexToColor(color),
    })
  })

  const handleResize = useEventCallback(() => handleCanvasResize())

  // 選択・移動ツール用の状態
  const selectionSnap = useSnapshot(selectionState)
  const selectionToolSnap = useSnapshot(selectionTool)

  // 選択ツールのUIを更新
  const updateSelectionUI = useEventCallback(() => {
    if (!engineRef.current) return

    const uiBuilder = new UIBuilder()

    // グリッド表示
    if (selectionToolSnap.snapToGrid) {
      uiBuilder.grid(20, { width: 800, height: 600 })
    }

    // 選択されたオブジェクトのバウンディングボックス
    if (selectionSnap.boundingBox && selectionSnap.selectedObjects.size > 0) {
      uiBuilder.selectionBox(selectionSnap.boundingBox, {
        showHandles: selectionToolSnap.showHandles,
      })
    }

    // 選択された頂点を表示
    if (selectionSnap.selectionMode === 'vertex') {
      // TODO: pathVerticesから選択された頂点を描画
      // 実装は後続で詳細化
    }

    // UIRendererに設定（実際の実装ではengineRef.current.uiRenderer.setUI(uiBuilder)）
    // 現在は仮実装
    console.log('Selection UI updated:', uiBuilder.build())
  })

  // 選択状態の変更時にUIを更新
  useEffect(() => {
    updateSelectionUI()
  }, [
    selectionSnap.selectedObjects.size,
    selectionSnap.boundingBox,
    selectionSnap.selectionMode,
  ])

  // 選択ツール設定の変更
  const handleSelectionModeChange = useEventCallback(
    (mode: 'object' | 'vertex') => {
      setSelectionMode(mode)
      if (mode === 'vertex') {
        setSelectedTool('vertexSelect')
      } else {
        setSelectedTool('select')
      }
    },
  )

  const handleSnapToGridToggle = useEventCallback((enabled: boolean) => {
    updateSelectionTool({ snapToGrid: enabled })
  })

  const handleShowHandlesToggle = useEventCallback((enabled: boolean) => {
    updateSelectionTool({ showHandles: enabled })
  })

  useEffect(() => {
    // デバッグ用
    ;(window as any)._es = engineState
    initializeWebGPU().catch((e) => {
      console.error('WebGPU initialization failed:', e)
    })

    // テスト用のオブジェクトを追加
    addTestObjects()

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (engineRef.current) {
        engineRef.current.dispose()
      }
    }
  }, [])

  useEffect(() => {
    handleCanvasResize()
  }, [])

  return (
    <div className="flex h-screen bg-background">
      {/* ツールバー */}
      <div className="w-16 bg-card border-r flex flex-col items-center py-4 space-y-2">
        {Object.entries(toolIcons).map(([toolId, Icon]) => (
          <Button
            key={toolId}
            variant={selectedTool === toolId ? 'default' : 'outline'}
            size="icon"
            onClick={() => handleToolSelect(toolId)}
            className="w-10 h-10"
          >
            <Icon className="w-4 h-4" />
          </Button>
        ))}

        <Separator className="my-2" />

        <Button
          variant={layersPanelOpen ? 'default' : 'outline'}
          size="icon"
          onClick={toggleLayersPanel}
          className="w-10 h-10"
        >
          <Layers className="w-4 h-4" />
        </Button>

        <Button
          variant={brushPanelOpen ? 'default' : 'outline'}
          size="icon"
          onClick={toggleBrushPanel}
          className="w-10 h-10"
        >
          <Settings className="w-4 h-4" />
        </Button>

        <Button
          variant={filtersPanelOpen ? 'default' : 'outline'}
          size="icon"
          onClick={toggleFiltersPanel}
          className="w-10 h-10"
        >
          <Filter className="w-4 h-4" />
        </Button>
      </div>

      {/* メインキャンバス */}
      <div className="flex-1 flex flex-col">
        {/* トップバー */}
        <div className="bg-card border-b px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Badge
              variant={editorSnap.isWebGPUSupported ? 'default' : 'destructive'}
            >
              WebGPU:{' '}
              {editorSnap.isWebGPUSupported ? 'サポート済み' : '未サポート'}
            </Badge>
            <Badge variant={editorSnap.isInitialized ? 'default' : 'secondary'}>
              エンジン: {editorSnap.isInitialized ? '初期化完了' : '初期化中'}
            </Badge>
            <Badge variant="outline">
              FPS: {Math.round(snap.performance.fps)}
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
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
              </Button>{' '}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // 選択モード切り替え
                  const newMode =
                    selectionSnap.selectionMode === 'object'
                      ? 'vertex'
                      : 'object'
                  handleSelectionModeChange(newMode)
                }}
              >
                <Target className="w-4 h-4 mr-1" />
                {selectionSnap.selectionMode === 'object'
                  ? 'オブジェクト選択'
                  : '頂点選択'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearSelection()}
              >
                選択解除
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!engineRef.current) return

                  // テスト用のストロークを作成
                  const testPath = createVectorPath([
                    { x: 100, y: 100 },
                    { x: 200, y: 150 },
                    { x: 300, y: 100 },
                    { x: 400, y: 200 },
                  ])

                  startDrawing(testPath)
                  setTimeout(() => {
                    const document = getActiveDocument()
                    endDrawing(document)
                  }, 100)
                }}
              >
                <Brush className="w-4 h-4 mr-1" />
                テストストローク
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center space-x-2">
              <Label htmlFor="color-picker" className="text-sm">
                色:
              </Label>
              <input
                id="color-picker"
                type="color"
                value={selectedColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-8 h-8 border border-border rounded cursor-pointer"
              />
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
          </div>
        </div>

        {/* キャンバス */}
        <div className="flex-1 relative bg-muted overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          />
        </div>
      </div>

      {/* サイドパネル */}
      <div className="w-80 p-2 bg-card border-l">
        <Tabs defaultValue="layers" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="layers">レイヤー</TabsTrigger>
            <TabsTrigger value="brush">ブラシ</TabsTrigger>
            <TabsTrigger value="selection">選択</TabsTrigger>
            <TabsTrigger value="filters">フィルター</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-4">
            {/* レイヤーパネル */}
            <TabsContent value="layers" className="space-y-4 mt-0">
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
                    <Label>ブラシタイプ</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Button
                        variant={
                          snap.brushConfig.type === 'vector'
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => setBrushConfig({ type: 'vector' })}
                      >
                        ベクター
                      </Button>
                      <Button
                        variant={
                          snap.brushConfig.type === 'scatter'
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => setBrushConfig({ type: 'scatter' })}
                      >
                        散布
                      </Button>
                    </div>
                  </div>

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

              {snap.brushConfig.type === 'scatter' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">散布設定</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>個数</Label>
                      <Slider
                        value={[snap.brushConfig.scatterConfig?.count || 5]}
                        onValueChange={(value) =>
                          setBrushConfig({
                            scatterConfig: {
                              count: value[0],
                              spread:
                                snap.brushConfig.scatterConfig?.spread || 10,
                              sizeVariation:
                                snap.brushConfig.scatterConfig?.sizeVariation ||
                                0.2,
                              opacityVariation:
                                snap.brushConfig.scatterConfig
                                  ?.opacityVariation || 0.1,
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
                        value={[snap.brushConfig.scatterConfig?.spread || 10]}
                        onValueChange={(value) =>
                          setBrushConfig({
                            scatterConfig: {
                              count: snap.brushConfig.scatterConfig?.count || 5,
                              spread: value[0],
                              sizeVariation:
                                snap.brushConfig.scatterConfig?.sizeVariation ||
                                0.2,
                              opacityVariation:
                                snap.brushConfig.scatterConfig
                                  ?.opacityVariation || 0.1,
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
              )}

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
                          snap.brushConfig.strokeSettings?.texture === 'pencil'
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() =>
                          setBrushConfig({
                            strokeSettings: {
                              texture: 'pencil',
                              scatterRange:
                                snap.brushConfig.strokeSettings?.scatterRange ||
                                0.5,
                              rotationAdjust:
                                snap.brushConfig.strokeSettings
                                  ?.rotationAdjust || 1,
                              randomRotation:
                                snap.brushConfig.strokeSettings
                                  ?.randomRotation || 0,
                              randomScale:
                                snap.brushConfig.strokeSettings?.randomScale ||
                                0,
                              inOutInfluence:
                                snap.brushConfig.strokeSettings
                                  ?.inOutInfluence || 1,
                              inOutLength:
                                snap.brushConfig.strokeSettings?.inOutLength ||
                                100,
                              divisions:
                                snap.brushConfig.strokeSettings?.divisions ||
                                1000,
                              pressureInfluence:
                                snap.brushConfig.strokeSettings
                                  ?.pressureInfluence || 0.8,
                              noiseInfluence:
                                snap.brushConfig.strokeSettings
                                  ?.noiseInfluence || 0,
                            },
                          })
                        }
                      >
                        鉛筆
                      </Button>
                      <Button
                        variant={
                          snap.brushConfig.strokeSettings?.texture ===
                          'airbrush'
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() =>
                          setBrushConfig({
                            strokeSettings: {
                              texture: 'airbrush',
                              scatterRange:
                                snap.brushConfig.strokeSettings?.scatterRange ||
                                0.5,
                              rotationAdjust:
                                snap.brushConfig.strokeSettings
                                  ?.rotationAdjust || 1,
                              randomRotation:
                                snap.brushConfig.strokeSettings
                                  ?.randomRotation || 0,
                              randomScale:
                                snap.brushConfig.strokeSettings?.randomScale ||
                                0,
                              inOutInfluence:
                                snap.brushConfig.strokeSettings
                                  ?.inOutInfluence || 1,
                              inOutLength:
                                snap.brushConfig.strokeSettings?.inOutLength ||
                                100,
                              divisions:
                                snap.brushConfig.strokeSettings?.divisions ||
                                1000,
                              pressureInfluence:
                                snap.brushConfig.strokeSettings
                                  ?.pressureInfluence || 0.8,
                              noiseInfluence:
                                snap.brushConfig.strokeSettings
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
                      スキャッター範囲:{' '}
                      {snap.brushConfig.strokeSettings?.scatterRange || 0.5}
                    </Label>
                    <Slider
                      value={[
                        snap.brushConfig.strokeSettings?.scatterRange || 0.5,
                      ]}
                      onValueChange={(value) =>
                        setBrushConfig({
                          strokeSettings: {
                            texture:
                              snap.brushConfig.strokeSettings?.texture ||
                              'pencil',
                            scatterRange: value[0],
                            rotationAdjust:
                              snap.brushConfig.strokeSettings?.rotationAdjust ||
                              1,
                            randomRotation:
                              snap.brushConfig.strokeSettings?.randomRotation ||
                              0,
                            randomScale:
                              snap.brushConfig.strokeSettings?.randomScale || 0,
                            inOutInfluence:
                              snap.brushConfig.strokeSettings?.inOutInfluence ||
                              1,
                            inOutLength:
                              snap.brushConfig.strokeSettings?.inOutLength ||
                              100,
                            divisions:
                              snap.brushConfig.strokeSettings?.divisions ||
                              1000,
                            pressureInfluence:
                              snap.brushConfig.strokeSettings
                                ?.pressureInfluence || 0.8,
                            noiseInfluence:
                              snap.brushConfig.strokeSettings?.noiseInfluence ||
                              0,
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
                      ランダム回転:{' '}
                      {snap.brushConfig.strokeSettings?.randomRotation || 0}
                    </Label>
                    <Slider
                      value={[
                        snap.brushConfig.strokeSettings?.randomRotation || 0,
                      ]}
                      onValueChange={(value) =>
                        setBrushConfig({
                          strokeSettings: {
                            texture:
                              snap.brushConfig.strokeSettings?.texture ||
                              'pencil',
                            scatterRange:
                              snap.brushConfig.strokeSettings?.scatterRange ||
                              0.5,
                            rotationAdjust:
                              snap.brushConfig.strokeSettings?.rotationAdjust ||
                              1,
                            randomRotation: value[0],
                            randomScale:
                              snap.brushConfig.strokeSettings?.randomScale || 0,
                            inOutInfluence:
                              snap.brushConfig.strokeSettings?.inOutInfluence ||
                              1,
                            inOutLength:
                              snap.brushConfig.strokeSettings?.inOutLength ||
                              100,
                            divisions:
                              snap.brushConfig.strokeSettings?.divisions ||
                              1000,
                            pressureInfluence:
                              snap.brushConfig.strokeSettings
                                ?.pressureInfluence || 0.8,
                            noiseInfluence:
                              snap.brushConfig.strokeSettings?.noiseInfluence ||
                              0,
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
                      ランダムスケール:{' '}
                      {snap.brushConfig.strokeSettings?.randomScale || 0}
                    </Label>
                    <Slider
                      value={[
                        snap.brushConfig.strokeSettings?.randomScale || 0,
                      ]}
                      onValueChange={(value) =>
                        setBrushConfig({
                          strokeSettings: {
                            texture:
                              snap.brushConfig.strokeSettings?.texture ||
                              'pencil',
                            scatterRange:
                              snap.brushConfig.strokeSettings?.scatterRange ||
                              0.5,
                            rotationAdjust:
                              snap.brushConfig.strokeSettings?.rotationAdjust ||
                              1,
                            randomRotation:
                              snap.brushConfig.strokeSettings?.randomRotation ||
                              0,
                            randomScale: value[0],
                            inOutInfluence:
                              snap.brushConfig.strokeSettings?.inOutInfluence ||
                              1,
                            inOutLength:
                              snap.brushConfig.strokeSettings?.inOutLength ||
                              100,
                            divisions:
                              snap.brushConfig.strokeSettings?.divisions ||
                              1000,
                            pressureInfluence:
                              snap.brushConfig.strokeSettings
                                ?.pressureInfluence || 0.8,
                            noiseInfluence:
                              snap.brushConfig.strokeSettings?.noiseInfluence ||
                              0,
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
                      インアウト効果:{' '}
                      {snap.brushConfig.strokeSettings?.inOutInfluence || 1}
                    </Label>
                    <Slider
                      value={[
                        snap.brushConfig.strokeSettings?.inOutInfluence || 1,
                      ]}
                      onValueChange={(value) =>
                        setBrushConfig({
                          strokeSettings: {
                            texture:
                              snap.brushConfig.strokeSettings?.texture ||
                              'pencil',
                            scatterRange:
                              snap.brushConfig.strokeSettings?.scatterRange ||
                              0.5,
                            rotationAdjust:
                              snap.brushConfig.strokeSettings?.rotationAdjust ||
                              1,
                            randomRotation:
                              snap.brushConfig.strokeSettings?.randomRotation ||
                              0,
                            randomScale:
                              snap.brushConfig.strokeSettings?.randomScale || 0,
                            inOutInfluence: value[0],
                            inOutLength:
                              snap.brushConfig.strokeSettings?.inOutLength ||
                              100,
                            divisions:
                              snap.brushConfig.strokeSettings?.divisions ||
                              1000,
                            pressureInfluence:
                              snap.brushConfig.strokeSettings
                                ?.pressureInfluence || 0.8,
                            noiseInfluence:
                              snap.brushConfig.strokeSettings?.noiseInfluence ||
                              0,
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
                {['blur', 'brightness', 'contrast', 'saturation', 'hue'].map(
                  (filterType) => (
                    <Card key={filterType}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="capitalize">{filterType}</Label>
                          <Switch />
                        </div>
                        <Slider
                          defaultValue={[
                            filterType === 'blur'
                              ? 1
                              : filterType === 'brightness'
                              ? 0
                              : 1,
                          ]}
                          max={
                            filterType === 'blur'
                              ? 10
                              : filterType === 'brightness'
                              ? 1
                              : 2
                          }
                          min={filterType === 'brightness' ? -1 : 0}
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
                        selectionSnap.selectionMode === 'object'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {selectionSnap.selectionMode === 'object'
                        ? 'オブジェクト'
                        : '頂点'}
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
                        console.log('複製')
                      }}
                    >
                      複製
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        // TODO: 削除機能
                        console.log('削除')
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
    </div>
  )
}
