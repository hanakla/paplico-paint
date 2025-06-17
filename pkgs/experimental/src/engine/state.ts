import { proxy, subscribe } from 'valtio'
import type { Document } from './document'
import { createPathArtObject, type PathArtObject } from './document/art-object'
import { createStroke } from './document/appearance'
import { debugLogger } from '../utils/debug-logger'

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
  type?: 'vector' | 'group' | 'raster'
  childLayerIds?: string[]
  expanded?: boolean
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

export interface LayerNode {
  layerId: string
  parentId: string | null
  order: number
}

export interface EngineState {
  canvas: {
    width: number
    height: number
    backgroundColor: Color
  }
  viewport: Viewport
  layers: Layer[]
  layerNodes: LayerNode[]
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
      type: 'vector',
    },
  ],
  layerNodes: [
    {
      layerId: 'layer-1',
      parentId: null,
      order: 0,
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

export const createLayer = (
  name: string,
  type: 'vector' | 'group' | 'raster' = 'vector',
): Layer => ({
  id: `layer-${Date.now()}`,
  name,
  visible: true,
  opacity: 1,
  blendMode: 'normal',
  paths: [],
  filters: [],
  type,
  ...(type === 'group' ? { childLayerIds: [], expanded: true } : {}),
})

export const addLayer = (
  name: string,
  type: 'vector' | 'group' | 'raster' = 'vector',
  parentId: string | null = null,
) => {
  const layer = createLayer(name, type)
  engineState.layers.push(layer)

  const maxOrder = engineState.layerNodes
    .filter((node) => node.parentId === parentId)
    .reduce((max, node) => Math.max(max, node.order), -1)

  engineState.layerNodes.push({
    layerId: layer.id,
    parentId,
    order: maxOrder + 1,
  })

  engineState.activeLayerId = layer.id
  return layer
}

export const removeLayer = (layerId: string) => {
  if (engineState.document) {
    const layer = engineState.document.layers[layerId]
    const nodeIndex = engineState.document.layerNodes.findIndex(
      (n) => n.layerId === layerId,
    )

    if (layer && Object.keys(engineState.document.layers).length > 1) {
      // レイヤーに属するすべてのartObjectを削除
      if (layer.artObjectIds) {
        layer.artObjectIds.forEach((artObjectId) => {
          delete doc.artObjects[artObjectId]
        })
      }

      // レイヤーノードを削除
      if (nodeIndex !== -1) {
        engineState.document.layerNodes.splice(nodeIndex, 1)
      }

      // レイヤーを削除
      delete engineState.document.layers[layerId]

      // アクティブレイヤーが削除された場合、別のレイヤーをアクティブに設定
      if (engineState.document.activeLayerId === layerId) {
        const remainingLayers = Object.keys(engineState.document.layers)
        if (remainingLayers.length > 0) {
          engineState.document.activeLayerId = remainingLayers[0]
        } else {
          engineState.document.activeLayerId = null
        }
      }
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
    // VectorPathを新しいドキュメント構造でPathArtObjectとして追加
    if (engineState.document) {
      convertVectorPathToArtObject(engineState.tools.currentStroke)
    }

    // 最終レンダリングのために少し遅延させてからクリア
    setTimeout(() => {
      engineState.tools.currentStroke = null
    }, 16) // 1フレーム分の遅延
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
  if (engineState.document) {
    const docLayer = engineState.document.layers[layerId]
    if (docLayer) {
      docLayer.visible = !docLayer.visible
    }
  }
}

export const setLayerOpacity = (layerId: string, opacity: number) => {
  if (engineState.document) {
    const docLayer = engineState.document.layers[layerId]
    if (docLayer) {
      const newOpacity = Math.max(0, Math.min(1, opacity))
      docLayer.opacity = newOpacity
    }
  }
}

export const setActiveLayer = (layerId: string) => {
  if (engineState.document) {
    const layer = engineState.document.layers[layerId]
    if (layer) {
      engineState.document.activeLayerId = layerId
    }
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

export const addGroupLayer = (name: string, parentId: string | null = null) => {
  return addLayer(name, 'group', parentId)
}

export const toggleGroupExpanded = (layerId: string) => {
  const layer = engineState.layers.find(
    (l) => l.id === layerId && l.type === 'group',
  )
  if (layer) {
    layer.expanded = !layer.expanded
  }
}

/**
 * ベクターレイヤーのartObjects展開状態を切り替え
 */
export const toggleLayerArtObjectsExpanded = (layerId: string) => {
  if (engineState.document) {
    const docLayer = engineState.document.layers[layerId]
    if (docLayer) {
      ;(docLayer as any).artObjectsExpanded = !(docLayer as any)
        .artObjectsExpanded
    }
  }
}

export const moveLayerToGroup = (
  layerId: string,
  targetGroupId: string | null,
) => {
  if (engineState.document) {
    const node = engineState.document.layerNodes.find(
      (n) => n.layerId === layerId,
    )
    if (node) {
      node.parentId = targetGroupId

      const maxOrder = engineState.document.layerNodes
        .filter((n) => n.parentId === targetGroupId)
        .reduce((max, n) => Math.max(max, n.order), -1)

      node.order = maxOrder + 1
    }
  }
}

export const moveArtObjectToLayer = (
  artObjectId: string,
  targetLayerId: string,
) => {
  if (engineState.document) {
    const artObject = engineState.document.artObjects[artObjectId]
    if (artObject) {
      const oldLayerId = artObject.layerId
      const oldLayer = engineState.document.layers[oldLayerId]
      const newLayer = engineState.document.layers[targetLayerId]

      if (oldLayer && newLayer) {
        // 古いレイヤーからartObjectIdを削除
        const oldIndex = oldLayer.artObjectIds.indexOf(artObjectId)
        if (oldIndex !== -1) {
          oldLayer.artObjectIds.splice(oldIndex, 1)
        }

        // 新しいレイヤーにartObjectIdを追加
        newLayer.artObjectIds.push(artObjectId)

        // artObjectのlayerIdを更新
        artObject.layerId = targetLayerId
      }
    }
  }
}

export const removeArtObject = (artObjectId: string) => {
  if (engineState.document) {
    const artObject = engineState.document.artObjects[artObjectId]
    if (artObject) {
      const layerId = artObject.layerId
      const layer = engineState.document.layers[layerId]

      if (layer) {
        // レイヤーからartObjectIdを削除
        const index = layer.artObjectIds.indexOf(artObjectId)
        if (index !== -1) {
          layer.artObjectIds.splice(index, 1)
        }
      }

      // ドキュメントからartObjectを削除
      delete engineState.document.artObjects[artObjectId]
    }
  }
}

export const reorderLayers = (layerIds: string[]) => {
  const newLayers: Layer[] = []
  layerIds.forEach((id) => {
    const layer = engineState.layers.find((l) => l.id === id)
    if (layer) {
      newLayers.push(layer)
    }
  })
  engineState.layers = newLayers
}

/**
 * 拡張ツリーアイテム：レイヤーとartObjectsの統合表示用
 */
export interface ExtendedTreeItem {
  type: 'layer' | 'artObject'
  id: string
  name: string
  depth: number
  visible: boolean
  locked?: boolean
  hasChildren: boolean
  isExpanded: boolean
  // artObject情報（type === 'artObject'の場合）
  parentLayerId?: string
}

/**
 * 新しいドキュメント構造用の拡張ツリー（レイヤー + artObjects）
 */
export const getExtendedTree = (document?: Document): ExtendedTreeItem[] => {
  const result: ExtendedTreeItem[] = []

  const doc = document || engineState.document
  if (!doc) {
    return []
  }

  const addChildrenToExtendedTree = (
    parentId: string | null,
    depth: number,
  ) => {
    const childNodes = doc.layerNodes
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => a.order - b.order)

    childNodes.forEach((node) => {
      const layer = doc.layers[node.layerId]
      if (layer) {
        // レイヤーノードを追加
        const hasChildren =
          doc.layerNodes.some((n) => n.parentId === layer.id) ||
          (layer.artObjectIds && layer.artObjectIds.length > 0)
        const isExpanded =
          layer.type === 'group'
            ? layer.expanded !== false
            : layer.type === 'vector'
            ? (layer as any).artObjectsExpanded !== false
            : false

        result.push({
          type: 'layer',
          id: layer.id,
          name: layer.name,
          depth,
          visible: layer.visible !== false,
          locked: layer.locked || false,
          hasChildren,
          isExpanded,
        })

        // グループレイヤーの場合、子レイヤーを追加
        if (layer.type === 'group' && isExpanded) {
          addChildrenToExtendedTree(layer.id, depth + 1)
        }

        // ベクターレイヤーの場合、artObjectsを追加
        if (
          layer.type === 'vector' &&
          isExpanded &&
          layer.artObjectIds &&
          layer.artObjectIds.length > 0
        ) {
          layer.artObjectIds.forEach((artObjectId) => {
            const artObject = doc.artObjects[artObjectId]
            if (artObject) {
              result.push({
                type: 'artObject',
                id: artObject.id,
                name: artObject.name,
                depth: depth + 1,
                visible: artObject.visible !== false,
                locked: artObject.locked || false,
                hasChildren: false,
                isExpanded: false,
                parentLayerId: layer.id,
              })
            }
          })
        }
      }
    })
  }

  addChildrenToExtendedTree(null, 0)
  return result
}

export const getLayerDepth = (layerId: string): number => {
  const node = engineState.layerNodes.find((n) => n.layerId === layerId)
  if (!node || !node.parentId) return 0

  return 1 + getLayerDepth(node.parentId)
}

export const isLayerVisible = (layerId: string): boolean => {
  const layer = engineState.layers.find((l) => l.id === layerId)
  if (!layer || !layer.visible) return false

  const node = engineState.layerNodes.find((n) => n.layerId === layerId)
  if (!node || !node.parentId) return true

  return isLayerVisible(node.parentId)
}

/**
 * VectorPathをPathArtObjectに変換してドキュメントに追加
 */
export const convertVectorPathToArtObject = (
  vectorPath: VectorPath,
): PathArtObject | null => {
  if (!engineState.document) {
    return null
  }

  // アクティブレイヤーを取得
  const activeLayerId = engineState.document.activeLayerId
  if (!activeLayerId) {
    return null
  }

  // 最初のアートボードを取得（デフォルト）
  const artboardId =
    engineState.document.artboards.length > 0
      ? engineState.document.artboards[0].id
      : null

  // VectorPathの色情報をRGBAColorに変換
  const strokeColor = {
    r: vectorPath.color.r,
    g: vectorPath.color.g,
    b: vectorPath.color.b,
    a: vectorPath.color.a,
  }

  // ストロークアピアランスを作成
  const strokeAppearance = createStroke({
    width: vectorPath.strokeWidth,
    color: strokeColor,
    opacity: vectorPath.color.a,
  })

  // PathArtObjectを作成
  const pathArtObject = createPathArtObject({
    name: `Stroke ${vectorPath.id}`,
    layerId: activeLayerId,
    artboardId: artboardId,
    path: {
      points: vectorPath.points.map((p) => ({ x: p.x, y: p.y })),
      closed: vectorPath.closed,
    },
    appearances: [strokeAppearance],
  })

  // ドキュメントのartObjectsに追加
  engineState.document.artObjects[pathArtObject.id] = pathArtObject

  // アクティブレイヤーのartObjectIdsに追加
  const activeLayer = engineState.document.layers[activeLayerId]
  if (activeLayer) {
    activeLayer.artObjectIds = [...activeLayer.artObjectIds, pathArtObject.id]
  }

  return pathArtObject
}

/**
 * ドキュメントを設定する
 */
export const setDocument = (document: Document | null) => {
  engineState.document = document

  if (document) {
  }
}
