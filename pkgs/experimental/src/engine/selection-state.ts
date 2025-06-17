/**
 * 選択・移動ツールの状態管理
 */

import { proxy } from 'valtio'
import { proxySet, proxyMap } from 'valtio/utils'
import {
  SelectionState,
  SelectionTool,
  SelectableObject,
  PathVertex,
  BoundingBox,
  Vector2,
  calculateBoundingBox,
  hitTestObject,
  hitTestVertex,
  Vec2,
} from './selection-types'

// 選択ツールの状態
export const selectionState = proxy<SelectionState>({
  selectedObjects: proxySet<string>(),
  selectedVertices: proxySet<string>(),
  selectionMode: 'object',
  isDragging: false,
  dragStartPosition: null,
  dragOffset: { x: 0, y: 0 },
  boundingBox: null,
})

// ツール設定
export const selectionTool = proxy<SelectionTool>({
  mode: 'select',
  isMultiSelect: false,
  showBoundingBox: true,
  showHandles: true,
  snapToGrid: false,
  snapToObjects: false,
})

// オブジェクトデータ（仮実装 - 実際のエンジンから取得）
export const selectableObjects = proxyMap<string, SelectableObject>()

// 頂点データ（仮実装 - パスデータから取得）
export const pathVertices = proxyMap<string, PathVertex>()

/**
 * オブジェクトを選択
 */
export function selectObject(
  objectId: string,
  multiSelect: boolean = false,
): void {
  if (!multiSelect) {
    selectionState.selectedObjects.clear()
    selectionState.selectedVertices.clear()
  }

  selectionState.selectedObjects.add(objectId)
  selectionState.selectionMode = 'object'
  updateBoundingBox()
}

/**
 * 頂点を選択
 */
export function selectVertex(
  vertexId: string,
  multiSelect: boolean = false,
): void {
  if (!multiSelect) {
    selectionState.selectedVertices.clear()
    selectionState.selectedObjects.clear()
  }

  selectionState.selectedVertices.add(vertexId)
  selectionState.selectionMode = 'vertex'
  updateBoundingBox()
}

/**
 * 選択を解除
 */
export function clearSelection(): void {
  selectionState.selectedObjects.clear()
  selectionState.selectedVertices.clear()
  selectionState.boundingBox = null
}

/**
 * オブジェクトの選択状態を切り替え
 */
export function toggleObjectSelection(objectId: string): void {
  if (selectionState.selectedObjects.has(objectId)) {
    selectionState.selectedObjects.delete(objectId)
  } else {
    selectionState.selectedObjects.add(objectId)
  }
  updateBoundingBox()
}

/**
 * 座標からオブジェクトを検索してヒットテスト
 */
export function hitTestAtPosition(
  position: Vector2,
  mode: 'object' | 'vertex' = 'object',
): string | null {
  if (mode === 'vertex') {
    // 頂点を優先してチェック
    for (const [id, vertex] of pathVertices) {
      if (hitTestVertex(position, vertex)) {
        return id
      }
    }
  }

  // オブジェクトをチェック（Z-index順）
  const objects = Array.from(selectableObjects.values())
    .filter((obj) => obj.visible !== false)
    .sort((a, b) => (b.layerId || '').localeCompare(a.layerId || ''))

  for (const obj of objects) {
    if (hitTestObject(position, obj)) {
      return obj.id
    }
  }

  return null
}

/**
 * ドラッグ開始
 */
export function startDrag(position: Vector2): void {
  selectionState.isDragging = true
  selectionState.dragStartPosition = position
  selectionState.dragOffset = { x: 0, y: 0 }
}

/**
 * ドラッグ更新
 */
export function updateDrag(position: Vector2): void {
  if (!selectionState.isDragging || !selectionState.dragStartPosition) return

  selectionState.dragOffset = Vec2.sub(
    position,
    selectionState.dragStartPosition,
  )

  // 選択されたオブジェクトを移動
  if (selectionState.selectionMode === 'object') {
    moveSelectedObjects(selectionState.dragOffset)
  } else if (selectionState.selectionMode === 'vertex') {
    moveSelectedVertices(selectionState.dragOffset)
  }
}

/**
 * ドラッグ終了
 */
export function endDrag(): void {
  selectionState.isDragging = false
  selectionState.dragStartPosition = null
  selectionState.dragOffset = { x: 0, y: 0 }
  updateBoundingBox()
}

/**
 * 選択されたオブジェクトを移動
 */
function moveSelectedObjects(offset: Vector2): void {
  for (const objectId of selectionState.selectedObjects) {
    const object = selectableObjects.get(objectId)
    if (object) {
      object.position = Vec2.add(object.position, offset)
      object.boundingBox.x = object.position.x
      object.boundingBox.y = object.position.y
    }
  }
}

/**
 * 選択された頂点を移動
 */
function moveSelectedVertices(offset: Vector2): void {
  for (const vertexId of selectionState.selectedVertices) {
    const vertex = pathVertices.get(vertexId)
    if (vertex) {
      vertex.position = Vec2.add(vertex.position, offset)
    }
  }
}

/**
 * バウンディングボックスを更新
 */
function updateBoundingBox(): void {
  if (selectionState.selectionMode === 'object') {
    const selectedObjs = Array.from(selectionState.selectedObjects)
      .map((id) => selectableObjects.get(id))
      .filter((obj) => obj !== undefined) as SelectableObject[]

    selectionState.boundingBox = calculateBoundingBox(selectedObjs)
  } else if (selectionState.selectionMode === 'vertex') {
    // 頂点選択時のバウンディングボックス
    const selectedVerts = Array.from(selectionState.selectedVertices)
      .map((id) => pathVertices.get(id))
      .filter((vertex) => vertex !== undefined) as PathVertex[]

    if (selectedVerts.length > 0) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity

      for (const vertex of selectedVerts) {
        minX = Math.min(minX, vertex.position.x)
        minY = Math.min(minY, vertex.position.y)
        maxX = Math.max(maxX, vertex.position.x)
        maxY = Math.max(maxY, vertex.position.y)
      }

      selectionState.boundingBox = {
        x: minX - 5,
        y: minY - 5,
        width: maxX - minX + 10,
        height: maxY - minY + 10,
      }
    } else {
      selectionState.boundingBox = null
    }
  }
}

/**
 * 選択ツールモードを設定
 */
export function setSelectionMode(mode: 'object' | 'vertex'): void {
  selectionState.selectionMode = mode
  if (mode === 'object') {
    selectionState.selectedVertices.clear()
  } else {
    selectionState.selectedObjects.clear()
  }
  updateBoundingBox()
}

/**
 * ツール設定を更新
 */
export function updateSelectionTool(updates: Partial<SelectionTool>): void {
  Object.assign(selectionTool, updates)
}

/**
 * テスト用のオブジェクトを追加
 */
export function addTestObjects(): void {
  // テスト用のオブジェクトを追加
  selectableObjects.set('obj1', {
    id: 'obj1',
    type: 'vector',
    position: { x: 100, y: 100 },
    size: { x: 150, y: 100 },
    boundingBox: { x: 100, y: 100, width: 150, height: 100 },
    layerId: 'layer1',
    visible: true,
  })

  selectableObjects.set('obj2', {
    id: 'obj2',
    type: 'vector',
    position: { x: 300, y: 200 },
    size: { x: 120, y: 80 },
    boundingBox: { x: 300, y: 200, width: 120, height: 80 },
    layerId: 'layer1',
    visible: true,
  })

  // テスト用の頂点を追加
  pathVertices.set('vertex1', {
    id: 'vertex1',
    position: { x: 100, y: 100 },
    type: 'anchor',
    parentPathId: 'obj1',
  })

  pathVertices.set('vertex2', {
    id: 'vertex2',
    position: { x: 250, y: 100 },
    type: 'anchor',
    parentPathId: 'obj1',
  })

  pathVertices.set('vertex3', {
    id: 'vertex3',
    position: { x: 250, y: 200 },
    type: 'anchor',
    parentPathId: 'obj1',
  })
}
