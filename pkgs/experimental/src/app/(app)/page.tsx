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
import { Input } from '@/components/ui/input'
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
  Palette,
  Filter,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Undo,
  Redo,
  Bug,
} from 'lucide-react'

import { PaplicoEngine } from '@/engine/Paplico'
import { ScatterBrushRenderer } from '@/engine/scatter-brush'
import { FilterRenderer } from '@/engine/filter-renderer'
import {
  engineState,
  setActiveTool,
  setBrushConfig,
  addLayer,
  removeLayer,
  startDrawing,
  endDrawing,
  addPointToCurrentStroke,
  toggleLayerVisibility,
  setLayerOpacity,
  setActiveLayer,
  createVectorPath,
  setDocument,
  undo,
  redo,
  canUndo,
  canRedo,
  Vector2,
} from '@/engine/state'
import { debugLogger } from '@/utils/debug-logger'
import { useUIStore } from '@/stores/ui-store'
import { createTestDocument, createSimpleTestDocument } from './_example'

const toolIcons = {
  brush: Brush,
  eraser: Eraser,
  select: MousePointer,
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
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      if (!navigator.gpu) {
        setIsWebGPUSupported(false)
        return
      }

      const paplicoEngine = new PaplicoEngine(canvas)
      const success = await paplicoEngine.initialize()

      if (success) {
        engineRef.current = paplicoEngine
        setIsWebGPUSupported(true)
        setIsInitialized(true)

        // 初期キャンバスサイズを設定
        const rect = canvas.getBoundingClientRect()
        paplicoEngine.resize(rect.width, rect.height)

        // PaplicoEngineは自動的に入力を処理し、レンダーループも実行されます
        // テスト用ドキュメントを作成・設定
        const testDoc = createTestDocument()
        setDocument(testDoc)

        // 初期キャンバスサイズを設定
        handleCanvasResize()
      } else {
        setIsWebGPUSupported(false)
      }
    } catch (error) {
      debugLogger.logWebGPUError(error, { stage: 'webgpu_initialization' })
      setIsWebGPUSupported(false)
    }
  })

  const handleCanvasResize = useEventCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !engineRef.current) return

    const rect = canvas.getBoundingClientRect()
    engineRef.current.resize(rect.width, rect.height)
  })

  const getCanvasCoordinates = useEventCallback(
    (screenX: number, screenY: number): Vector2 => {
      const canvas = canvasRef.current
      if (!canvas || !engineRef.current) return { x: 0, y: 0 }

      const rect = canvas.getBoundingClientRect()
      const x = screenX - rect.left
      const y = screenY - rect.top

      return engineRef.current.screenToWorld({ x, y })
    },
  )

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

  const handleAddLayer = useEventCallback(() => {
    addLayer(`レイヤー ${snap.layers.length + 1}`)
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

  const handleResize = useEventCallback(() => handleCanvasResize())

  useEffect(() => {
    debugLogger.clear().then(() => {
      initializeWebGPU()
    })

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
  }, [initializeWebGPU, handleResize])

  useEffect(() => {
    handleCanvasResize()
  }, [handleCanvasResize])

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
            <Badge variant={isWebGPUSupported ? 'default' : 'destructive'}>
              WebGPU: {isWebGPUSupported ? 'サポート済み' : '未サポート'}
            </Badge>
            <Badge variant={isInitialized ? 'default' : 'secondary'}>
              エンジン: {isInitialized ? '初期化完了' : '初期化中'}
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
                onClick={undo}
                disabled={!canUndo()}
              >
                <Undo className="w-4 h-4 mr-1" />
                アンドゥ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={!canRedo()}
              >
                <Redo className="w-4 h-4 mr-1" />
                リドゥ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await debugLogger.info('Debug test triggered', {
                    document: {
                      id: snap.document?.id,
                      artboardCount: snap.document?.artboards.length,
                      layerCount: snap.layers.length,
                      layerNodes: snap.document?.layerNodes.length,
                    },
                    canvas: {
                      width: canvasRef.current?.width,
                      height: canvasRef.current?.height,
                    },
                    webgpu: {
                      isInitialized,
                      isWebGPUSupported,
                    },
                  })
                }}
              >
                <Bug className="w-4 h-4 mr-1" />
                デバッグ
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
      <div className="w-80 bg-card border-l">
        <Tabs defaultValue="layers" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="layers">レイヤー</TabsTrigger>
            <TabsTrigger value="brush">ブラシ</TabsTrigger>
            <TabsTrigger value="filters">フィルター</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto p-4">
            {/* レイヤーパネル */}
            <TabsContent value="layers" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">レイヤー</h3>
                <Button size="sm" onClick={handleAddLayer}>
                  <Plus className="w-4 h-4 mr-1" />
                  追加
                </Button>
              </div>

              <div className="space-y-2">
                {snap.layers.map((layer) => (
                  <Card
                    key={layer.id}
                    className={
                      layer.id === snap.activeLayerId
                        ? 'ring-2 ring-primary'
                        : ''
                    }
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleLayerVisibilityToggle(layer.id)
                            }
                          >
                            {layer.visible ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </Button>
                          <span
                            className="text-sm font-medium cursor-pointer"
                            onClick={() => handleSetActiveLayer(layer.id)}
                          >
                            {layer.name}
                          </span>
                        </div>

                        {snap.layers.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLayer(layer.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      <div className="mt-2">
                        <Label className="text-xs">
                          不透明度: {Math.round(layer.opacity * 100)}%
                        </Label>
                        <Slider
                          value={[layer.opacity * 100]}
                          onValueChange={(value) =>
                            handleSetLayerOpacity(layer.id, value[0] / 100)
                          }
                          max={100}
                          min={0}
                          step={1}
                          className="mt-1"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
          </div>
        </Tabs>
      </div>
    </div>
  )
}
