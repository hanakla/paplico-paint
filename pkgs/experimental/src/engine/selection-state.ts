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
  createRectFromPoints,
  isObjectInSelectionBox,
} from './selection-types'
import { debugState } from './webgpu/core-engine'

/**
 * ドキュメントアクセス用外部関数（エンジンから注入される）
 */
let externalGetDocumentFunction: (() => any) | null = null

export function setDocumentAccessFunction(fn: () => any): void {
  externalGetDocumentFunction = fn
}

/**
 * 実際のドキュメントからbounding boxを計算
 */
function calculateBoundingBoxFromDocument(
  document: any,
  selectedIds: string[],
): BoundingBox | null {
  if (selectedIds.length === 0) return null

  let minX = Infinity,
    minY = Infinity
  let maxX = -Infinity,
    maxY = -Infinity
  let hasValidObject = false

  for (const objectId of selectedIds) {
    const artObject = document.artObjects[objectId]
    if (!artObject || !artObject.visible) continue

    if (artObject.type === 'path' && artObject.path?.points?.length > 0) {
      // パスの各点からbounding boxを計算
      for (const point of artObject.path.points) {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
        hasValidObject = true
      }
    }
  }

  if (!hasValidObject) return null

  const padding = 5
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + 2 * padding,
    height: maxY - minY + 2 * padding,
  }
}

/**
 * debugStateの選択情報を更新
 */
function updateDebugSelectionState(): void {
  debugState.selection.selectedObjectsCount =
    selectionState.selectedObjects.size
  debugState.selection.selectedVerticesCount =
    selectionState.selectedVertices.size
  debugState.selection.selectionMode = selectionState.selectionMode
  debugState.selection.lastSelectionUpdateTime = Date.now()
  debugState.selection.boundingBoxAvailable =
    selectionState.boundingBox !== null
  debugState.selection.boundingBox = selectionState.boundingBox
}

// 選択ツールの状態
export const selectionState = proxy<SelectionState>({
  selectedObjects: proxySet<string>(),
  selectedVertices: proxySet<string>(),
  selectionMode: 'object',
  isDragging: false,
  dragStartPosition: null,
  dragOffset: { x: 0, y: 0 },
  boundingBox: null,
  // 矩形選択ドラッグボックス
  isDragSelecting: false,
  dragSelectionStart: null,
  dragSelectionEnd: null,
  dragSelectionBox: null,
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
  updateDebugSelectionState()
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
  updateDebugSelectionState()
}

/**
 * 選択を解除
 */
export function clearSelection(): void {
  selectionState.selectedObjects.clear()
  selectionState.selectedVertices.clear()
  selectionState.boundingBox = null
  updateDebugSelectionState()
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
  updateDebugSelectionState()
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

  // debugStateに記録
  debugState.movement.drag.isDragging = true
  debugState.movement.drag.startPosition = { ...position }
  debugState.movement.drag.currentPosition = { ...position }
  debugState.movement.drag.currentOffset = { x: 0, y: 0 }
  debugState.movement.drag.selectedObjectIds = Array.from(
    selectionState.selectedObjects,
  )

  debugState.movement.executionLog.push({
    timestamp: Date.now(),
    action: 'start_drag',
    data: {
      position: { ...position },
      selectedObjectIds: Array.from(selectionState.selectedObjects),
    },
  })
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

  // debugStateに記録
  debugState.movement.drag.currentPosition = { ...position }
  debugState.movement.drag.currentOffset = { ...selectionState.dragOffset }

  debugState.movement.executionLog.push({
    timestamp: Date.now(),
    action: 'update_drag',
    data: {
      position: { ...position },
      offset: { ...selectionState.dragOffset },
      selectionMode: selectionState.selectionMode,
    },
  })

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
  // ドラッグ終了時に一度だけ移動コマンドを実行
  if (selectionState.isDragging && externalMoveObjectsFunction) {
    const selectedIds = Array.from(selectionState.selectedObjects)
    const finalOffset = selectionState.dragOffset

    if (
      selectedIds.length > 0 &&
      (finalOffset.x !== 0 || finalOffset.y !== 0)
    ) {
      debugState.movement.executionLog.push({
        timestamp: Date.now(),
        action: 'end_drag',
        data: {
          selectedIds: [...selectedIds],
          finalOffset: { ...finalOffset },
          willExecuteCommand: true,
        },
      })

      externalMoveObjectsFunction(selectedIds, finalOffset)
    } else {
      debugState.movement.executionLog.push({
        timestamp: Date.now(),
        action: 'end_drag',
        data: {
          selectedIds: [...selectedIds],
          finalOffset: { ...finalOffset },
          willExecuteCommand: false,
          reason:
            selectedIds.length === 0
              ? 'No objects selected'
              : 'No movement detected',
        },
      })
    }
  }

  // debugStateをリセット
  debugState.movement.drag.isDragging = false
  debugState.movement.drag.startPosition = null
  debugState.movement.drag.currentPosition = null
  debugState.movement.drag.currentOffset = null

  selectionState.isDragging = false
  selectionState.dragStartPosition = null
  selectionState.dragOffset = { x: 0, y: 0 }
  updateBoundingBox()
}

/**
 * 選択されたオブジェクトを移動
 * 外部のエンジンから移動処理関数を注入可能にする
 */
let externalMoveObjectsFunction:
  | ((objectIds: string[], offset: Vector2) => void)
  | null = null

export function setExternalMoveObjectsFunction(
  fn: (objectIds: string[], offset: Vector2) => void,
): void {
  externalMoveObjectsFunction = fn
}

/**
 * 選択されたオブジェクト・頂点を削除
 * 外部のエンジンから削除処理関数を注入可能にする
 */
let externalDeleteObjectsFunction: ((objectIds: string[]) => void) | null = null
let externalDeleteVerticesFunction: ((vertexIds: string[]) => void) | null =
  null

export function setExternalDeleteFunctions(
  deleteObjects: (objectIds: string[]) => void,
  deleteVertices: (vertexIds: string[]) => void,
): void {
  externalDeleteObjectsFunction = deleteObjects
  externalDeleteVerticesFunction = deleteVertices
}

/**
 * 選択されたアイテムを削除
 */
export function deleteSelected(): void {
  if (
    selectionState.selectionMode === 'object' &&
    selectionState.selectedObjects.size > 0
  ) {
    const selectedIds = Array.from(selectionState.selectedObjects)
    externalDeleteObjectsFunction?.(selectedIds)
    clearSelection()
  } else if (
    selectionState.selectionMode === 'vertex' &&
    selectionState.selectedVertices.size > 0
  ) {
    const selectedIds = Array.from(selectionState.selectedVertices)
    externalDeleteVerticesFunction?.(selectedIds)
    clearSelection()
  }
  // clearSelection内でupdateDebugSelectionState()が呼ばれるので、ここでは不要
}

function moveSelectedObjects(offset: Vector2): void {
  // ドラッグ中は視覚的なプレビューのみ（実際のドキュメント更新はendDragで実行）
  // 実装: UIレンダラーに一時的なオフセット情報を渡すなどの処理が必要
  // 現在はoffsetを保存しておくのみ
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
    // 実際のドキュメントからオブジェクトを取得
    if (externalGetDocumentFunction) {
      const document = externalGetDocumentFunction()
      if (document && document.artObjects) {
        const selectedIds = Array.from(selectionState.selectedObjects)
        selectionState.boundingBox = calculateBoundingBoxFromDocument(
          document,
          selectedIds,
        )
        return
      }
    }

    // フォールバック: 従来の方法
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
  updateDebugSelectionState()
}

/**
 * ツール設定を更新
 */
export function updateSelectionTool(updates: Partial<SelectionTool>): void {
  Object.assign(selectionTool, updates)
}

/**
 * 矩形選択ドラッグ開始
 */
export function startDragSelection(position: Vector2): void {
  selectionState.isDragSelecting = true
  selectionState.dragSelectionStart = position
  selectionState.dragSelectionEnd = position
  selectionState.dragSelectionBox = {
    x: position.x,
    y: position.y,
    width: 0,
    height: 0,
  }
}

/**
 * 矩形選択ドラッグ更新
 */
export function updateDragSelection(position: Vector2): void {
  if (!selectionState.isDragSelecting || !selectionState.dragSelectionStart)
    return

  selectionState.dragSelectionEnd = position
  selectionState.dragSelectionBox = createRectFromPoints(
    selectionState.dragSelectionStart,
    position,
  )
}

/**
 * 矩形選択ドラッグ終了
 */
export function endDragSelection(multiSelect: boolean = false): void {
  if (!selectionState.isDragSelecting || !selectionState.dragSelectionBox) {
    clearDragSelection()
    return
  }

  // 選択ボックス内のオブジェクトを検索
  const objectsInSelection: string[] = []

  for (const [id, object] of selectableObjects) {
    if (isObjectInSelectionBox(object, selectionState.dragSelectionBox)) {
      objectsInSelection.push(id)
    }
  }

  // 選択を更新
  if (!multiSelect) {
    clearSelection()
  }

  for (const objectId of objectsInSelection) {
    selectionState.selectedObjects.add(objectId)
  }

  selectionState.selectionMode = 'object'
  updateBoundingBox()
  updateDebugSelectionState()
  clearDragSelection()
}

/**
 * 矩形選択状態をクリア
 */
export function clearDragSelection(): void {
  selectionState.isDragSelecting = false
  selectionState.dragSelectionStart = null
  selectionState.dragSelectionEnd = null
  selectionState.dragSelectionBox = null
}
