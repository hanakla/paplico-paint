import { proxy, subscribe } from 'valtio'
import type { Document } from './document'

export interface Vector2 {
  x: number
  y: number
}

export interface Color {
  r: number
  g: number
  b: number
  a: number
}

export interface VectorPath {
  id: string
  points: Vector2[]
  color: Color
  strokeWidth: number
  closed: boolean
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  opacity: number
  blendMode: string
  paths: VectorPath[]
  filters: FilterConfig[]
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
  layers: Layer[]
  activeLayerId: string | null
  /** 新しいドキュメント構造 */
  document: Document | null
  brushConfig: BrushConfig
  tools: {
    activeTool: 'brush' | 'eraser' | 'select' | 'pan' | 'zoom'
    isDrawing: boolean
    currentStroke: VectorPath | null
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
  layers: [
    {
      id: 'layer-1',
      name: 'Background',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      paths: [],
      filters: [],
    },
  ],
  activeLayerId: 'layer-1',
  /** 新しいドキュメント構造 */
  document: null,
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
  },
  tools: {
    activeTool: 'brush',
    isDrawing: false,
    currentStroke: null,
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

export const createLayer = (name: string): Layer => ({
  id: `layer-${Date.now()}`,
  name,
  visible: true,
  opacity: 1,
  blendMode: 'normal',
  paths: [],
  filters: [],
})

export const addLayer = (name: string) => {
  const layer = createLayer(name)
  engineState.layers.push(layer)
  engineState.activeLayerId = layer.id
  return layer
}

export const removeLayer = (layerId: string) => {
  const index = engineState.layers.findIndex((l) => l.id === layerId)
  if (index !== -1 && engineState.layers.length > 1) {
    engineState.layers.splice(index, 1)
    if (engineState.activeLayerId === layerId) {
      engineState.activeLayerId = engineState.layers[Math.max(0, index - 1)].id
    }
  }
}

export const getActiveLayer = (): Layer | null => {
  return (
    engineState.layers.find((l) => l.id === engineState.activeLayerId) || null
  )
}

export const addPathToActiveLayer = (path: VectorPath) => {
  const activeLayer = getActiveLayer()
  if (activeLayer) {
    activeLayer.paths.push(path)
  }
}

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

export const endDrawing = () => {
  if (engineState.tools.currentStroke) {
    addPathToActiveLayer(engineState.tools.currentStroke)
    engineState.tools.currentStroke = null
  }
  engineState.tools.isDrawing = false
}

export const addPointToCurrentStroke = (point: Vector2) => {
  if (engineState.tools.currentStroke) {
    engineState.tools.currentStroke.points.push(point)
  } else {
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

export const toggleLayerVisibility = (layerId: string) => {
  const layer = engineState.layers.find((l) => l.id === layerId)
  if (layer) {
    layer.visible = !layer.visible
  }
}

export const setLayerOpacity = (layerId: string, opacity: number) => {
  const layer = engineState.layers.find((l) => l.id === layerId)
  if (layer) {
    layer.opacity = Math.max(0, Math.min(1, opacity))
  }
}

export const setActiveLayer = (layerId: string) => {
  if (engineState.layers.find((l) => l.id === layerId)) {
    engineState.activeLayerId = layerId
  }
}

export const addFilterToLayer = (layerId: string, filter: FilterConfig) => {
  const layer = engineState.layers.find((l) => l.id === layerId)
  if (layer) {
    layer.filters.push(filter)
  }
}

export const removeFilterFromLayer = (layerId: string, filterId: string) => {
  const layer = engineState.layers.find((l) => l.id === layerId)
  if (layer) {
    const index = layer.filters.findIndex((f) => f.id === filterId)
    if (index !== -1) {
      layer.filters.splice(index, 1)
    }
  }
}

export const updateFilterParam = (
  layerId: string,
  filterId: string,
  param: string,
  value: number,
) => {
  const layer = engineState.layers.find((l) => l.id === layerId)
  if (layer) {
    const filter = layer.filters.find((f) => f.id === filterId)
    if (filter) {
      filter.params[param] = value
    }
  }
}

export const toggleFilter = (layerId: string, filterId: string) => {
  const layer = engineState.layers.find((l) => l.id === layerId)
  if (layer) {
    const filter = layer.filters.find((f) => f.id === filterId)
    if (filter) {
      filter.enabled = !filter.enabled
    }
  }
}

export const createVectorPath = (
  points: Vector2[],
  color: Color,
  strokeWidth: number,
): VectorPath => ({
  id: `path-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  points,
  color,
  strokeWidth,
  closed: false,
})

export const saveStateToHistory = () => {
  const currentState = {
    layers: JSON.parse(JSON.stringify(engineState.layers)),
    timestamp: Date.now(),
  }

  engineState.history.undoStack.push(currentState)

  if (engineState.history.undoStack.length > engineState.history.maxHistory) {
    engineState.history.undoStack.shift()
  }

  engineState.history.redoStack = []
}

export const undo = () => {
  if (engineState.history.undoStack.length === 0) return false

  const currentState = {
    layers: JSON.parse(JSON.stringify(engineState.layers)),
    timestamp: Date.now(),
  }

  engineState.history.redoStack.push(currentState)

  const previousState = engineState.history.undoStack.pop()
  if (previousState) {
    engineState.layers = previousState.layers
  }

  return true
}

export const redo = () => {
  if (engineState.history.redoStack.length === 0) return false

  const currentState = {
    layers: JSON.parse(JSON.stringify(engineState.layers)),
    timestamp: Date.now(),
  }

  engineState.history.undoStack.push(currentState)

  const nextState = engineState.history.redoStack.pop()
  if (nextState) {
    engineState.layers = nextState.layers
  }

  return true
}

export const canUndo = () => engineState.history.undoStack.length > 0
export const canRedo = () => engineState.history.redoStack.length > 0

/**
 * ドキュメントを設定する
 */
export const setDocument = (document: Document | null) => {
  engineState.document = document

  if (document) {
  }
}
