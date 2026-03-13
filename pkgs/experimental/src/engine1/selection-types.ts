/**
 * 選択・移動システムの型定義とユーティリティ
 */

export interface Vector2 {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectableObject {
  id: string;
  type: 'vector' | 'raster' | 'text';
  position: Vector2;
  size: Vector2;
  rotation?: number;
  boundingBox: BoundingBox;
  layerId?: string;
  visible?: boolean;
}

export interface PathVertex {
  id: string;
  position: Vector2;
  type: 'anchor' | 'control1' | 'control2';
  parentPathId: string;
  segmentIndex?: number;
}

export interface BezierHandle {
  id: string;
  position: Vector2;
  type: 'in' | 'out';
  parentVertexId: string;
  visible: boolean;
}

export interface VertexEditState {
  selectedVertices: Set<string>;
  selectedHandles: Set<string>;
  isDraggingVertex: boolean;
  isDraggingHandle: boolean;
  dragStartPosition: Vector2 | null;
  dragTargetType: 'vertex' | 'handle' | null;
  dragTargetId: string | null;
  showHandles: boolean;
  hoveredVertex: string | null;
  hoveredHandle: string | null;
}

export interface SelectionState {
  selectedObjects: Set<string>;
  selectedVertices: Set<string>;
  selectionMode: 'object' | 'vertex';
  isDragging: boolean;
  dragStartPosition: Vector2 | null;
  dragOffset: Vector2;
  boundingBox: BoundingBox | null;
  // 矩形選択ドラッグボックス
  isDragSelecting: boolean;
  dragSelectionStart: Vector2 | null;
  dragSelectionEnd: Vector2 | null;
  dragSelectionBox: BoundingBox | null;
}

export interface SelectionTool {
  mode: 'select' | 'move';
  isMultiSelect: boolean;
  showBoundingBox: boolean;
  showHandles: boolean;
  snapToGrid: boolean;
  snapToObjects: boolean;
}

/**
 * バウンディングボックス計算
 */
export function calculateBoundingBox(
  objects: SelectableObject[],
): BoundingBox | null {
  if (objects.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objects) {
    const bbox = obj.boundingBox;
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.width);
    maxY = Math.max(maxY, bbox.y + bbox.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * 点がバウンディングボックス内にあるかチェック
 */
export function isPointInBoundingBox(
  point: Vector2,
  bbox: BoundingBox,
): boolean {
  return (
    point.x >= bbox.x &&
    point.x <= bbox.x + bbox.width &&
    point.y >= bbox.y &&
    point.y <= bbox.y + bbox.height
  );
}

/**
 * オブジェクトのヒットテスト
 */
export function hitTestObject(
  point: Vector2,
  object: SelectableObject,
): boolean {
  return isPointInBoundingBox(point, object.boundingBox);
}

/**
 * 頂点のヒットテスト（半径6px）
 */
export function hitTestVertex(
  point: Vector2,
  vertex: PathVertex,
  scale: number = 1,
): boolean {
  const hitRadius = 6 / scale;
  const dx = point.x - vertex.position.x;
  const dy = point.y - vertex.position.y;
  return Math.sqrt(dx * dx + dy * dy) <= hitRadius;
}

/**
 * ベジエハンドルのヒットテスト（半径4px）
 */
export function hitTestHandle(
  point: Vector2,
  handle: BezierHandle,
  scale: number = 1,
): boolean {
  const hitRadius = 4 / scale;
  const dx = point.x - handle.position.x;
  const dy = point.y - handle.position.y;
  return Math.sqrt(dx * dx + dy * dy) <= hitRadius;
}

/**
 * 距離計算
 */
export function distance(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 2つの点から矩形を作成
 */
export function createRectFromPoints(
  start: Vector2,
  end: Vector2,
): BoundingBox {
  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * 矩形と矩形の交差判定
 */
export function intersectsBoundingBox(
  rect1: BoundingBox,
  rect2: BoundingBox,
): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  );
}

/**
 * オブジェクトが矩形選択範囲内にあるかチェック
 */
export function isObjectInSelectionBox(
  object: SelectableObject,
  selectionBox: BoundingBox,
): boolean {
  return intersectsBoundingBox(object.boundingBox, selectionBox);
}

/**
 * ベクトル演算
 */
export const Vec2 = {
  add: (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a: Vector2, b: Vector2): Vector2 => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (v: Vector2, s: number): Vector2 => ({ x: v.x * s, y: v.y * s }),
  dot: (a: Vector2, b: Vector2): number => a.x * b.x + a.y * b.y,
  length: (v: Vector2): number => Math.sqrt(v.x * v.x + v.y * v.y),
  normalize: (v: Vector2): Vector2 => {
    const len = Vec2.length(v);
    return len > 0 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
  },
};
