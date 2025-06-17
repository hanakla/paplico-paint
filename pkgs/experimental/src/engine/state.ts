import { proxy, subscribe } from 'valtio'
import type { Document } from './document'
import { createPathArtObject, type PathArtObject } from './document/art-object'
import { createStroke } from './document/appearance'
import { VectorPath } from './document/path'

// VectorPathを再エクスポート
export type { VectorPath }

export interface Vector2 {
  x: number
  y: number
  /** 筆圧 (0.0-1.0) */
  pressure?: number
  /** ペンの傾きX (-1.0 - 1.0) */
  tiltX?: number
  /** ペンの傾きY (-1.0 - 1.0) */
  tiltY?: number
  /** 描画時の速度 (ピクセル/秒) */
  velocity?: number
  /** この点が描画された時刻 (performance.now()) */
  timestamp?: number
}

export interface Color {
  r: number
  g: number
  b: number
  a: number
}

export interface FilterConfig {
  id: string
  type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'hue'
  enabled: boolean
  params: Record<string, number>
}

export interface BrushConfig {
  id: string
  type: 'vector' | 'scatter'
  size: number
  opacity: number
  color: Color
  scatterConfig?: {
    count: number
    spread: number
    sizeVariation: number
    opacityVariation: number
  }
  strokeSettings?: {
    texture: 'pencil' | 'airbrush'
    scatterRange: number
    rotationAdjust: number
    randomRotation: number
    randomScale: number
    inOutInfluence: number
    inOutLength: number
    divisions: number
    pressureInfluence: number
    noiseInfluence: number
    /** 筆圧によるサイズへの影響度 (0.0-1.0) */
    pressureSizeInfluence?: number
    /** 筆圧による不透明度への影響度 (0.0-1.0) */
    pressureOpacityInfluence?: number
    /** ペンの傾きによる形状への影響度 (0.0-1.0) */
    tiltInfluence?: number
    /** 描画速度によるサイズへの影響度 (0.0-1.0) */
    velocitySizeInfluence?: number
    /** 描画速度による不透明度への影響度 (0.0-1.0) */
    velocityOpacityInfluence?: number
    /** 最小サイズ制限 (0.0-1.0, ブラシサイズに対する割合) */
    minSizeRatio?: number
    /** 最小不透明度制限 (0.0-1.0) */
    minOpacity?: number
  }
}

export interface Viewport {
  x: number
  y: number
  zoom: number
  rotation: number
  width: number
  height: number
}

export interface EngineState {
  canvas: {
    width: number
    height: number
    backgroundColor: Color
  }
  viewport: Viewport
  brushConfig: BrushConfig
  tools: {
    activeTool: 'brush' | 'eraser' | 'select' | 'pan' | 'zoom'
    isDrawing: boolean
    currentStroke: VectorPath | null
  }
  selection: {
    selectedObjectIds: string[]
    isDragging: boolean
    dragStartPosition: Vector2 | null
    dragOffset: Vector2 | null
  }
  ui: {
    showLayers: boolean
    showBrushSettings: boolean
    showFilters: boolean
    sidebarWidth: number
  }
  performance: {
    fps: number
    frameTime: number
    webgpuDevice: any
    webgpuContext: any
  }
  history: {
    undoStack: any[]
    redoStack: any[]
    maxHistory: number
  }
}

export const engineState = proxy<EngineState>({
  canvas: {
    width: 1920,
    height: 1080,
    backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
  },
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
    rotation: 0,
    width: 800,
    height: 600,
  },
  brushConfig: {
    id: 'default-brush',
    type: 'vector',
    size: 10,
    opacity: 1,
    color: { r: 0, g: 0, b: 0, a: 1 },
    scatterConfig: {
      count: 5,
      spread: 10,
      sizeVariation: 0.2,
      opacityVariation: 0.1,
    },
    strokeSettings: {
      texture: 'pencil',
      scatterRange: 0.5,
      rotationAdjust: 1,
      randomRotation: 0,
      randomScale: 0,
      inOutInfluence: 1,
      inOutLength: 100,
      divisions: 1000,
      pressureInfluence: 0.8,
      noiseInfluence: 0,
      pressureSizeInfluence: 0.8,
      pressureOpacityInfluence: 0.6,
      tiltInfluence: 0.3,
      velocitySizeInfluence: 0.4,
      velocityOpacityInfluence: 0.2,
      minSizeRatio: 0.1,
      minOpacity: 0.1,
    },
  },
  tools: {
    activeTool: 'brush',
    isDrawing: false,
    currentStroke: null,
  },
  selection: {
    selectedObjectIds: [],
    isDragging: false,
    dragStartPosition: null,
    dragOffset: null,
  },
  ui: {
    showLayers: true,
    showBrushSettings: false,
    showFilters: false,
    sidebarWidth: 300,
  },
  performance: {
    fps: 60,
    frameTime: 16.67,
    webgpuDevice: null,
    webgpuContext: null,
  },
  history: {
    undoStack: [],
    redoStack: [],
    maxHistory: 50,
  },
})

export const setBrushConfig = (config: Partial<BrushConfig>) => {
  Object.assign(engineState.brushConfig, config)
}

export const setViewport = (viewport: Partial<Viewport>) => {
  Object.assign(engineState.viewport, viewport)
}

export const setActiveTool = (tool: EngineState['tools']['activeTool']) => {
  engineState.tools.activeTool = tool
}

export const startDrawing = (path: VectorPath) => {
  engineState.tools.isDrawing = true
  engineState.tools.currentStroke = path
}

export const endDrawing = (document: Document | null) => {
  if (engineState.tools.currentStroke && document) {
    // VectorPathを新しいドキュメント構造でPathArtObjectとして追加
    const defaultColor = { r: 0, g: 0, b: 0, a: 1 } // デフォルト色
    const defaultStrokeWidth = 2 // デフォルトストローク幅
    convertVectorPathToArtObject(
      engineState.tools.currentStroke,
      document,
      defaultColor,
      defaultStrokeWidth,
    )
  }
  engineState.tools.isDrawing = false
}

export const addPointToCurrentStroke = (point: Vector2) => {
  if (engineState.tools.currentStroke) {
    engineState.tools.currentStroke.points.push(point)
  }
}

export const setWebGPUDevice = (device: any, context: any) => {
  engineState.performance.webgpuDevice = device
  engineState.performance.webgpuContext = context
}

export const updatePerformanceMetrics = (fps: number, frameTime: number) => {
  engineState.performance.fps = fps
  engineState.performance.frameTime = frameTime
}

export const subscribeToState = (callback: () => void) => {
  return subscribe(engineState, callback)
}

export const createVectorPath = (points: Vector2[]): VectorPath => ({
  points,
  closed: false,
})

/**
 * VectorPathをPathArtObjectに変換してドキュメントに追加
 */
export const convertVectorPathToArtObject = (
  vectorPath: VectorPath,
  document: Document,
  color: Color,
  strokeWidth: number,
  id?: string,
): PathArtObject | null => {
  // アクティブレイヤーを取得
  const activeLayerId = document.activeLayerId
  if (!activeLayerId) {
    return null
  }

  // 最初のアートボードを取得（デフォルト）
  const artboardId =
    document.artboards.length > 0 ? document.artboards[0].id : null

  // 色情報をRGBAColorに変換
  const strokeColor = {
    r: color.r,
    g: color.g,
    b: color.b,
    a: color.a,
  }

  // 現在のブラシ設定を使用してストロークアピアランスを作成
  const strokeAppearance = createStroke({
    width: strokeWidth,
    color: strokeColor,
    opacity: 1.0,
    style: 'solid',
    lineCap: 'round',
    lineJoin: 'round',
    // UI設定から詳細ブラシ設定を追加
    brushSettings: engineState.brushConfig.strokeSettings
      ? {
          texture: engineState.brushConfig.strokeSettings.texture,
          scatterRange: engineState.brushConfig.strokeSettings.scatterRange,
          rotationAdjust: engineState.brushConfig.strokeSettings.rotationAdjust,
          randomRotation: engineState.brushConfig.strokeSettings.randomRotation,
          randomScale: engineState.brushConfig.strokeSettings.randomScale,
          inOutInfluence: engineState.brushConfig.strokeSettings.inOutInfluence,
          inOutLength: engineState.brushConfig.strokeSettings.inOutLength,
          divisions: engineState.brushConfig.strokeSettings.divisions,
          pressureInfluence:
            engineState.brushConfig.strokeSettings.pressureInfluence,
          noiseInfluence: engineState.brushConfig.strokeSettings.noiseInfluence,
        }
      : undefined,
  })

  // PathArtObjectを作成
  const pathArtObject = createPathArtObject({
    name: `Stroke ${id || 'unnamed'}`,
    layerId: activeLayerId,
    artboardId: artboardId,
    path: {
      points: vectorPath.points.map((p) => ({
        x: p.x,
        y: p.y,
        pressure: p.pressure,
        tilt:
          (p as any).tiltX !== undefined && (p as any).tiltY !== undefined
            ? { x: (p as any).tiltX, y: (p as any).tiltY }
            : undefined,
        // handleIn, handleOutは現在未使用のためundefined
      })),
      closed: vectorPath.closed,
    },
    appearances: [strokeAppearance],
  })

  // ドキュメントのartObjectsに追加
  document.artObjects[pathArtObject.id] = pathArtObject

  // アクティブレイヤーのartObjectIdsに追加
  const activeLayer = document.layers[activeLayerId]
  if (activeLayer && activeLayer.type === 'vector') {
    activeLayer.artObjectIds = [...activeLayer.artObjectIds, pathArtObject.id]
  }

  return pathArtObject
}

/**
 * ドキュメントを設定する
 */
export const setDocument = (document: Document | null) => {
  // この関数は後方互換性のためのスタブ
  // 実際のドキュメント管理はPaplicoEngineで行う
}

// 選択操作のヘルパー関数
export const selectObject = (objectId: string) => {
  if (!engineState.selection.selectedObjectIds.includes(objectId)) {
    engineState.selection.selectedObjectIds.push(objectId)
  }
}

export const deselectObject = (objectId: string) => {
  const index = engineState.selection.selectedObjectIds.indexOf(objectId)
  if (index > -1) {
    engineState.selection.selectedObjectIds.splice(index, 1)
  }
}

export const toggleObjectSelection = (objectId: string) => {
  if (engineState.selection.selectedObjectIds.includes(objectId)) {
    deselectObject(objectId)
  } else {
    selectObject(objectId)
  }
}

export const clearSelection = () => {
  engineState.selection.selectedObjectIds = []
}

export const selectMultipleObjects = (objectIds: string[]) => {
  engineState.selection.selectedObjectIds = [...objectIds]
}

export const isObjectSelected = (objectId: string): boolean => {
  return engineState.selection.selectedObjectIds.includes(objectId)
}

export const startDragging = (position: Vector2) => {
  engineState.selection.isDragging = true
  engineState.selection.dragStartPosition = { ...position }
  engineState.selection.dragOffset = { x: 0, y: 0 }
}

export const updateDragOffset = (offset: Vector2) => {
  if (engineState.selection.isDragging) {
    engineState.selection.dragOffset = { ...offset }
  }
}

export const finishDragging = () => {
  engineState.selection.isDragging = false
  engineState.selection.dragStartPosition = null
  engineState.selection.dragOffset = null
}

export const cancelDragging = () => {
  engineState.selection.isDragging = false
  engineState.selection.dragStartPosition = null
  engineState.selection.dragOffset = null
}
