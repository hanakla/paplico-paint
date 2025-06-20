import { VectorPath } from './document/path'
import { StrokeParams } from './document/appearance'
import { Document } from './document/document'

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

export interface Viewport {
  x: number
  y: number
  zoom: number
  rotation: number
  width: number
  height: number
}

export interface RenderDebugInfo {
  frameNumber: number
  timestamp: number
  renderPasses: {
    name: string
    duration: number
    vertexCount: number
    triangleCount: number
    drawCalls: number
  }[]
  totalRenderTime: number
  memoryUsage: {
    buffers: number
    textures: number
    totalBytes: number
  }
  layerInfo: {
    layerId: string
    layerName: string
    artObjectCount: number
    appearanceCount: number
    triangles: number
  }[]
  renderedObjects: {
    artObjectId: string
    artObjectName: string
    layerId: string
    layerName: string
    type: 'path' | 'group'
    pathPointCount?: number
    appearances: {
      type: 'fill' | 'stroke'
      id: string
      color?: { r: number; g: number; b: number; a: number }
      strokeWidth?: number
      fillRule?: string
      enabled: boolean
    }[]
    renderStats: {
      triangles: number
      vertices: number
      renderTime: number
    }
  }[]
  cameraState: {
    zoom: number
    position: { x: number; y: number }
    rotation: number
  }
  webgpuStats: {
    deviceLimits: any
    adapterInfo: any
    features: string[]
  } | null
}

export interface EngineState {
  canvas: {
    width: number
    height: number
    backgroundColor: Color
  }
  viewport: Viewport
  strokeSettings: StrokeParams
  tools: {
    activeTool:
      | 'brush'
      | 'eraser'
      | 'select'
      | 'move'
      | 'vertexSelect'
      | 'vertexEdit'
      | 'pan'
      | 'zoom'
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
    showDebug: boolean
    debugPaneOpen: boolean
    sidebarWidth: number
    debugPaneWidth: number
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
  debug: {
    capturedFrame: RenderDebugInfo | null
    isCapturing: boolean
    showStats: boolean
    hitTest: {
      lastHitPosition: { x: number; y: number } | null
      lastHitResults: {
        artObjectId: string
        artObjectName: string
        layerId: string
        layerName: string
        distance: number
        worldPosition: { x: number; y: number }
        localPosition: { x: number; y: number }
      }[]
      hitCount: number
    }
  }
  /** ドキュメント（新しい構造） */
  document: Document
}

export const getStrokeParams = (engineState: EngineState): StrokeParams => {
  const { strokeSettings } = engineState
  const { brushSettings } = strokeSettings

  return {
    width: strokeSettings.width,
    color: strokeSettings.color,
    style: strokeSettings.style,
    dashPattern: strokeSettings.dashPattern,
    lineCap: strokeSettings.lineCap,
    lineJoin: strokeSettings.lineJoin,
    miterLimit: strokeSettings.miterLimit,
    opacity: strokeSettings.opacity,
    blendMode: strokeSettings.blendMode,
    brushSettings: {
      texture: brushSettings?.texture ?? 'pencil',
      scatterConfig: {
        count: brushSettings?.scatterConfig?.count ?? 5,
        spread: brushSettings?.scatterConfig?.spread ?? 10,
        opacityVariation: brushSettings?.scatterConfig?.opacityVariation ?? 0.2,
        sizeVariation: brushSettings?.scatterConfig?.sizeVariation ?? 0.1,
      },
      rotationAdjust: brushSettings?.rotationAdjust ?? 1,
      randomRotation: brushSettings?.randomRotation ?? 0,
      randomScale: brushSettings?.randomScale ?? 0,
      inOutInfluence: brushSettings?.inOutInfluence ?? 1,
      inOutLength: brushSettings?.inOutLength ?? 100,
      divisions: brushSettings?.divisions ?? 1000,
      pressureInfluence: brushSettings?.pressureInfluence ?? 0.8,
      noiseInfluence: brushSettings?.noiseInfluence ?? 0,
      pressureSizeInfluence: brushSettings?.pressureSizeInfluence ?? 0.8,
      pressureOpacityInfluence: brushSettings?.pressureOpacityInfluence ?? 0.6,
      tiltInfluence: brushSettings?.tiltInfluence ?? 0.3,
      velocitySizeInfluence: brushSettings?.velocitySizeInfluence ?? 0.4,
      velocityOpacityInfluence: brushSettings?.velocityOpacityInfluence ?? 0.2,
      minSizeRatio: brushSettings?.minSizeRatio ?? 0.1,
      minOpacity: brushSettings?.minOpacity ?? 0.1,
    },
  }
}

export const createVectorPath = (points: Vector2[]): VectorPath => ({
  points,
  closed: false,
})
