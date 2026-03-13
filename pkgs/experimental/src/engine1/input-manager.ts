import { Emitter } from '@paplico/shared-lib';
import type { Vector2 } from './state';

/**
 * 拡張されたポインターイベントデータ
 */
export interface EnhancedPointerEvent {
  originalEvent: PointerEvent;
  /** 座標 */
  x: number;
  y: number;
  /** 筆圧 (0.0-1.0) */
  pressure: number;
  /** ペンの傾きX (-1.0 - 1.0) */
  tiltX: number;
  /** ペンの傾きY (-1.0 - 1.0) */
  tiltY: number;
  /** 描画時の速度 (ピクセル/秒) */
  velocity: number;
  /** この点が取得された時刻 (performance.now()) */
  timestamp: number;
  /** ポインターの種類 */
  pointerType: string;
}

/**
 * ストローク開始イベント
 */
export interface StrokeStartEvent {
  points: Vector2[];
  initialEvent: EnhancedPointerEvent;
}

/**
 * ストローク更新イベント
 */
export interface StrokeUpdateEvent {
  points: Vector2[];
  currentEvent: EnhancedPointerEvent;
}

/**
 * ストローク完了イベント
 */
export interface StrokeCompleteEvent {
  points: Vector2[];
  finalEvent: EnhancedPointerEvent;
}

/**
 * パンイベント
 */
export interface PanEvent {
  delta: Vector2;
  currentEvent: EnhancedPointerEvent;
}

export type InputManagerEvents = {
  pointerDown: EnhancedPointerEvent;
  pointerMove: EnhancedPointerEvent;
  pointerUp: EnhancedPointerEvent;
  wheel: WheelEvent;
  keyDown: KeyboardEvent;
  keyUp: KeyboardEvent;
  // 高レベルイベント
  strokeStart: StrokeStartEvent;
  strokeUpdate: StrokeUpdateEvent;
  strokeComplete: StrokeCompleteEvent;
  pan: PanEvent;
};

/**
 * PaplicoEngineインターフェース（循環参照回避のため）
 */
export interface IInputManagerHost {
  state: {
    tools: {
      activeTool: string;
    };
  };
}

/**
 * 入力管理クラス
 * マウス、タッチ、キーボード入力を統合管理
 * pressure、tilt、velocity の詳細データを提供
 */
export class InputManager extends Emitter<InputManagerEvents> {
  private abort: AbortController;
  private canvas: HTMLCanvasElement;
  private lastPointerEvent: EnhancedPointerEvent | null = null;
  private lastMoveTime: number = 0;

  // 状態管理
  private isDrawing = false;
  private isPanning = false;
  private currentStrokePoints: Vector2[] = [];
  private panStartPosition: Vector2 | null = null;
  private isSpacePressed = false;

  // PaplicoEngineへの参照
  private paplicoEngine: IInputManagerHost;

  constructor(canvas: HTMLCanvasElement, paplicoEngine: IInputManagerHost) {
    super();

    this.abort = new AbortController();
    this.canvas = canvas;
    this.paplicoEngine = paplicoEngine;
    this.setupEventListeners();
  }

  /**
   * イベントリスナーを設定
   */
  private setupEventListeners(): void {
    const { signal } = this.abort;

    // ポインターイベント
    this.canvas.addEventListener(
      'pointerdown',
      this.handlePointerDown.bind(this),
      { signal },
    );
    this.canvas.addEventListener(
      'pointermove',
      this.handlePointerMove.bind(this),
      { signal },
    );
    this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this), {
      signal,
    });
    this.canvas.addEventListener(
      'pointercancel',
      this.handlePointerUp.bind(this),
      { signal },
    );

    // ホイールイベント
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), {
      signal,
    });

    // キーボードイベント
    window.addEventListener('keydown', this.handleKeyDown.bind(this), {
      signal,
    });
    window.addEventListener('keyup', this.handleKeyUp.bind(this), {
      signal,
    });

    // コンテキストメニューを無効化（右クリック用）
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault(), {
      signal,
    });
  }

  /**
   * PointerEventからEnhancedPointerEventを生成
   */
  private createEnhancedPointerEvent(
    event: PointerEvent,
  ): EnhancedPointerEvent {
    const currentTime = performance.now();
    const rect = this.canvas.getBoundingClientRect();

    // キャンバス相対座標を計算
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 速度計算
    let velocity = 0;
    if (this.lastPointerEvent && this.lastMoveTime > 0) {
      const deltaTime = (currentTime - this.lastMoveTime) / 1000; // 秒単位
      const deltaX = x - this.lastPointerEvent.x;
      const deltaY = y - this.lastPointerEvent.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (deltaTime > 0) {
        velocity = distance / deltaTime; // ピクセル/秒
      }
    }

    const enhancedEvent: EnhancedPointerEvent = {
      originalEvent: event,
      x,
      y,
      pressure: this.extractPressure(event),
      tiltX: this.extractTiltX(event),
      tiltY: this.extractTiltY(event),
      velocity,
      timestamp: currentTime,
      pointerType: event.pointerType,
    };

    return enhancedEvent;
  }

  /**
   * PointerEventから筆圧情報を抽出
   */
  private extractPressure(event: PointerEvent): number {
    // PointerEvent.pressureは0.0-1.0の範囲
    let pressure = event.pressure;

    // マウスの場合はクリック状態を筆圧として扱う
    if (event.pointerType === 'mouse') {
      pressure = event.buttons > 0 ? 1.0 : 0.0;
    }

    // タッチの場合はforce property（iOS Safari）を優先
    if (
      event.pointerType === 'touch' &&
      'force' in event &&
      typeof (event as any).force === 'number'
    ) {
      pressure = (event as any).force;
    }

    return Math.max(0.0, Math.min(1.0, pressure));
  }

  /**
   * PointerEventからペンの傾きX情報を抽出
   */
  private extractTiltX(event: PointerEvent): number {
    // PointerEvent.tiltXは度単位 (-90 - 90)
    const tiltX = event.tiltX || 0;

    // -1.0 から 1.0 の範囲に正規化
    return Math.max(-1.0, Math.min(1.0, tiltX / 90.0));
  }

  /**
   * PointerEventからペンの傾きY情報を抽出
   */
  private extractTiltY(event: PointerEvent): number {
    // PointerEvent.tiltYは度単位 (-90 - 90)
    const tiltY = event.tiltY || 0;

    // -1.0 から 1.0 の範囲に正規化
    return Math.max(-1.0, Math.min(1.0, tiltY / 90.0));
  }

  /**
   * ポインターダウンイベントハンドラ
   */
  private handlePointerDown(event: PointerEvent): void {
    this.canvas.setPointerCapture(event.pointerId);

    const enhancedEvent = this.createEnhancedPointerEvent(event);
    this.lastPointerEvent = enhancedEvent;
    this.lastMoveTime = enhancedEvent.timestamp;

    this.emit('pointerDown', enhancedEvent);

    // 高レベルイベントの処理
    if (event.button === 2 || event.button === 1 || this.isSpacePressed) {
      // 右クリック、中クリック、またはスペースキー押下中はパン
      this.isPanning = true;
      this.panStartPosition = { x: enhancedEvent.x, y: enhancedEvent.y };
    } else if (event.button === 0) {
      // 左クリックの処理はツールモードに応じて決定
      const activeTool = this.paplicoEngine.state.tools.activeTool;

      if (activeTool === 'brush') {
        // ブラシツールの場合のみストロークイベントを発行
        this.isDrawing = true;
        this.currentStrokePoints = [{ x: enhancedEvent.x, y: enhancedEvent.y }];

        this.emit('strokeStart', {
          points: [...this.currentStrokePoints],
          initialEvent: enhancedEvent,
        });
      }
    }
  }

  /**
   * ポインタームーブイベントハンドラ
   */
  private handlePointerMove(event: PointerEvent): void {
    const enhancedEvent = this.createEnhancedPointerEvent(event);
    this.lastPointerEvent = enhancedEvent;
    this.lastMoveTime = enhancedEvent.timestamp;

    this.emit('pointerMove', enhancedEvent);

    // 高レベルイベントの処理
    if (this.isPanning && this.panStartPosition) {
      // パン中
      const delta: Vector2 = {
        x: enhancedEvent.x - this.panStartPosition.x,
        y: enhancedEvent.y - this.panStartPosition.y,
      };
      this.panStartPosition = { x: enhancedEvent.x, y: enhancedEvent.y };

      this.emit('pan', {
        delta,
        currentEvent: enhancedEvent,
      });
    } else if (this.isDrawing) {
      // 描画中
      this.currentStrokePoints.push({ x: enhancedEvent.x, y: enhancedEvent.y });

      this.emit('strokeUpdate', {
        points: [...this.currentStrokePoints],
        currentEvent: enhancedEvent,
      });
    }
  }

  /**
   * ポインターアップイベントハンドラ
   */
  private handlePointerUp(event: PointerEvent): void {
    this.canvas.releasePointerCapture(event.pointerId);

    const enhancedEvent = this.createEnhancedPointerEvent(event);
    this.lastPointerEvent = null;
    this.lastMoveTime = 0;

    this.emit('pointerUp', enhancedEvent);

    // 高レベルイベントの処理
    if (this.isDrawing) {
      // 描画終了
      this.emit('strokeComplete', {
        points: [...this.currentStrokePoints],
        finalEvent: enhancedEvent,
      });
      this.isDrawing = false;
      this.currentStrokePoints = [];
    }

    if (this.isPanning) {
      // パン終了
      this.isPanning = false;
      this.panStartPosition = null;
    }
  }

  /**
   * ホイールイベントハンドラ
   */
  private handleWheel(event: WheelEvent): void {
    this.emit('wheel', event);
  }

  /**
   * キーダウンイベントハンドラ
   */
  private handleKeyDown(event: KeyboardEvent): void {
    this.emit('keyDown', event);

    // スペースキーでパンモード
    if (event.code === 'Space' && !this.isSpacePressed) {
      this.isSpacePressed = true;
    }
  }

  /**
   * キーアップイベントハンドラ
   */
  private handleKeyUp(event: KeyboardEvent): void {
    this.emit('keyUp', event);

    // スペースキー解除
    if (event.code === 'Space') {
      this.isSpacePressed = false;
      if (this.isPanning) {
        this.isPanning = false;
        this.panStartPosition = null;
      }
    }
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.abort.abort();
  }
}
