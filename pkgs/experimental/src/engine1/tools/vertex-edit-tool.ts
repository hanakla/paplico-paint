/**
 * 頂点選択・編集ツール
 * Illustratorのような三次ベジエ曲線の頂点とハンドル操作を提供
 */

import { proxy } from 'valtio';
import type { DocumentContext } from '../document-manager';
import {
  type BezierHandle,
  hitTestHandle,
  hitTestVertex,
  type PathVertex,
  type Vector2,
  type VertexEditState,
} from '../selection-types';

export interface VertexEditToolOptions {
  showHandles: boolean;
  snapToGrid: boolean;
  gridSize: number;
  multiSelect: boolean;
}

export class VertexEditTool {
  public state: VertexEditState;
  public options: VertexEditToolOptions;
  private documentContext: DocumentContext | null = null;
  private vertices: Map<string, PathVertex> = new Map();
  private handles: Map<string, BezierHandle> = new Map();

  constructor(options: Partial<VertexEditToolOptions> = {}) {
    this.state = proxy<VertexEditState>({
      selectedVertices: new Set(),
      selectedHandles: new Set(),
      isDraggingVertex: false,
      isDraggingHandle: false,
      dragStartPosition: null,
      dragTargetType: null,
      dragTargetId: null,
      showHandles: false,
      hoveredVertex: null,
      hoveredHandle: null,
    });

    this.options = {
      showHandles: true,
      snapToGrid: false,
      gridSize: 10,
      multiSelect: true,
      ...options,
    };
  }

  /**
   * ドキュメントコンテキストを設定
   */
  setDocumentContext(context: DocumentContext): void {
    this.documentContext = context;
    this.updateVerticesAndHandles();
  }

  /**
   * ドキュメントから頂点とハンドル情報を更新
   */
  private updateVerticesAndHandles(): void {
    if (!this.documentContext) return;

    this.vertices.clear();
    this.handles.clear();

    const document = this.documentContext.document;

    // 全てのパスオブジェクトから頂点を抽出
    Object.values(document.artObjects).forEach((artObject: any) => {
      if (artObject.type === 'path' && artObject.path?.points) {
        artObject.path.points.forEach((point: any, index: number) => {
          const vertexId = `${artObject.id}-vertex-${index}`;

          const vertex: PathVertex = {
            id: vertexId,
            position: { x: point.x, y: point.y },
            type: 'anchor',
            parentPathId: artObject.id,
            segmentIndex: index,
          };

          this.vertices.set(vertexId, vertex);

          // ベジエハンドルを生成（簡略化：直線セグメントから推定）
          if (index > 0 && index < artObject.path.points.length - 1) {
            const prevPoint = artObject.path.points[index - 1];
            const nextPoint = artObject.path.points[index + 1];

            // 入力ハンドル（前の点への方向）
            const inHandle: BezierHandle = {
              id: `${vertexId}-in`,
              position: {
                x: point.x - (point.x - prevPoint.x) * 0.3,
                y: point.y - (point.y - prevPoint.y) * 0.3,
              },
              type: 'in',
              parentVertexId: vertexId,
              visible: this.state.selectedVertices.has(vertexId),
            };

            // 出力ハンドル（次の点への方向）
            const outHandle: BezierHandle = {
              id: `${vertexId}-out`,
              position: {
                x: point.x + (nextPoint.x - point.x) * 0.3,
                y: point.y + (nextPoint.y - point.y) * 0.3,
              },
              type: 'out',
              parentVertexId: vertexId,
              visible: this.state.selectedVertices.has(vertexId),
            };

            this.handles.set(inHandle.id, inHandle);
            this.handles.set(outHandle.id, outHandle);
          }
        });
      }
    });
  }

  /**
   * マウスダウン処理
   */
  onMouseDown(worldPosition: Vector2, event: PointerEvent): boolean {
    const scale = this.documentContext ? 1.0 : 1.0; // カメラのズームスケールを取得する必要がある

    // ハンドルのヒットテストを最初に実行（優先度高）
    for (const handle of this.handles.values()) {
      if (handle.visible && hitTestHandle(worldPosition, handle, scale)) {
        this.startHandleDrag(handle, worldPosition);
        return true;
      }
    }

    // 頂点のヒットテスト
    for (const vertex of this.vertices.values()) {
      if (hitTestVertex(worldPosition, vertex, scale)) {
        this.startVertexDrag(
          vertex,
          worldPosition,
          event.ctrlKey || event.metaKey,
        );
        return true;
      }
    }

    // 何もヒットしなかった場合は選択をクリア
    if (!event.shiftKey) {
      this.clearSelection();
    }

    return false;
  }

  /**
   * 頂点ドラッグ開始
   */
  private startVertexDrag(
    vertex: PathVertex,
    position: Vector2,
    multiSelect: boolean,
  ): void {
    if (!multiSelect) {
      if (!this.state.selectedVertices.has(vertex.id)) {
        this.state.selectedVertices.clear();
      }
    }

    this.state.selectedVertices.add(vertex.id);
    this.state.isDraggingVertex = true;
    this.state.dragStartPosition = position;
    this.state.dragTargetType = 'vertex';
    this.state.dragTargetId = vertex.id;

    // 選択された頂点のハンドルを表示
    this.updateHandleVisibility();
  }

  /**
   * ハンドルドラッグ開始
   */
  private startHandleDrag(handle: BezierHandle, position: Vector2): void {
    this.state.selectedHandles.clear();
    this.state.selectedHandles.add(handle.id);
    this.state.isDraggingHandle = true;
    this.state.dragStartPosition = position;
    this.state.dragTargetType = 'handle';
    this.state.dragTargetId = handle.id;
  }

  /**
   * マウス移動処理
   */
  onMouseMove(worldPosition: Vector2): boolean {
    if (this.state.isDraggingVertex) {
      this.dragVertices(worldPosition);
      return true;
    }

    if (this.state.isDraggingHandle) {
      this.dragHandle(worldPosition);
      return true;
    }

    // ホバー状態の更新
    this.updateHoverState(worldPosition);
    return false;
  }

  /**
   * 頂点ドラッグ処理
   */
  private dragVertices(worldPosition: Vector2): void {
    if (!this.state.dragStartPosition) return;

    const offset = {
      x: worldPosition.x - this.state.dragStartPosition.x,
      y: worldPosition.y - this.state.dragStartPosition.y,
    };

    // スナップ処理
    if (this.options.snapToGrid) {
      offset.x =
        Math.round(offset.x / this.options.gridSize) * this.options.gridSize;
      offset.y =
        Math.round(offset.y / this.options.gridSize) * this.options.gridSize;
    }

    // 選択されたすべての頂点を移動
    for (const vertexId of this.state.selectedVertices) {
      const vertex = this.vertices.get(vertexId);
      if (vertex) {
        vertex.position.x += offset.x;
        vertex.position.y += offset.y;

        // 関連するハンドルも一緒に移動
        const inHandle = this.handles.get(`${vertexId}-in`);
        const outHandle = this.handles.get(`${vertexId}-out`);

        if (inHandle) {
          inHandle.position.x += offset.x;
          inHandle.position.y += offset.y;
        }

        if (outHandle) {
          outHandle.position.x += offset.x;
          outHandle.position.y += offset.y;
        }
      }
    }

    this.state.dragStartPosition = worldPosition;
    this.applyChangesToDocument();
  }

  /**
   * ハンドルドラッグ処理
   */
  private dragHandle(worldPosition: Vector2): void {
    if (!this.state.dragTargetId) return;

    const handle = this.handles.get(this.state.dragTargetId);
    if (!handle) return;

    // ハンドル位置を更新
    handle.position = { ...worldPosition };

    // スナップ処理
    if (this.options.snapToGrid) {
      handle.position.x =
        Math.round(handle.position.x / this.options.gridSize) *
        this.options.gridSize;
      handle.position.y =
        Math.round(handle.position.y / this.options.gridSize) *
        this.options.gridSize;
    }

    // 対応するハンドルを対称に移動（Illustrator風の動作）
    const vertex = this.vertices.get(handle.parentVertexId);
    if (vertex) {
      const oppositeHandleId =
        handle.type === 'in'
          ? `${handle.parentVertexId}-out`
          : `${handle.parentVertexId}-in`;

      const oppositeHandle = this.handles.get(oppositeHandleId);
      if (oppositeHandle) {
        // ベクトルを反転して対称位置に配置
        const dx = handle.position.x - vertex.position.x;
        const dy = handle.position.y - vertex.position.y;

        oppositeHandle.position.x = vertex.position.x - dx;
        oppositeHandle.position.y = vertex.position.y - dy;
      }
    }

    this.applyChangesToDocument();
  }

  /**
   * マウスアップ処理
   */
  onMouseUp(): void {
    this.state.isDraggingVertex = false;
    this.state.isDraggingHandle = false;
    this.state.dragStartPosition = null;
    this.state.dragTargetType = null;
    this.state.dragTargetId = null;
  }

  /**
   * ホバー状態更新
   */
  private updateHoverState(worldPosition: Vector2): void {
    const scale = 1.0; // カメラのズームスケールを取得

    this.state.hoveredVertex = null;
    this.state.hoveredHandle = null;

    // ハンドルのホバーチェック
    for (const handle of this.handles.values()) {
      if (handle.visible && hitTestHandle(worldPosition, handle, scale)) {
        this.state.hoveredHandle = handle.id;
        return;
      }
    }

    // 頂点のホバーチェック
    for (const vertex of this.vertices.values()) {
      if (hitTestVertex(worldPosition, vertex, scale)) {
        this.state.hoveredVertex = vertex.id;
        return;
      }
    }
  }

  /**
   * ハンドルの表示状態を更新
   */
  private updateHandleVisibility(): void {
    for (const handle of this.handles.values()) {
      handle.visible =
        this.state.selectedVertices.has(handle.parentVertexId) &&
        this.options.showHandles;
    }
  }

  /**
   * 選択をクリア
   */
  clearSelection(): void {
    this.state.selectedVertices.clear();
    this.state.selectedHandles.clear();
    this.updateHandleVisibility();
  }

  /**
   * ドキュメントに変更を適用
   */
  private applyChangesToDocument(): void {
    if (!this.documentContext) return;

    const document = this.documentContext.document;

    // 頂点の変更をパスオブジェクトに反映
    for (const vertex of this.vertices.values()) {
      const artObject = document.artObjects[vertex.parentPathId];
      if (
        artObject &&
        artObject.type === 'path' &&
        vertex.segmentIndex !== undefined
      ) {
        if (artObject.path.points[vertex.segmentIndex]) {
          artObject.path.points[vertex.segmentIndex].x = vertex.position.x;
          artObject.path.points[vertex.segmentIndex].y = vertex.position.y;
        }
      }
    }
  }

  /**
   * 表示用の頂点リストを取得
   */
  getVerticesForRender(): PathVertex[] {
    return Array.from(this.vertices.values());
  }

  /**
   * 表示用のハンドルリストを取得
   */
  getHandlesForRender(): BezierHandle[] {
    return Array.from(this.handles.values()).filter((handle) => handle.visible);
  }
}
