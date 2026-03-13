import type { Document } from '../document';
import type { ICommand } from './command';

/**
 * ヒストリーエントリー
 */
export interface HistoryEntry {
  command: ICommand;
  timestamp: Date;
}

/**
 * ヒストリー変更イベント
 */
export interface HistoryChangeEvent {
  type: 'execute' | 'undo' | 'redo' | 'clear';
  command?: ICommand;
  canUndo: boolean;
  canRedo: boolean;
  undoStackSize: number;
  redoStackSize: number;
}

/**
 * ドキュメントヒストリー管理クラス
 */
export class DocumentHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxHistorySize: number;
  private document: Document;
  private changeListeners: ((event: HistoryChangeEvent) => void)[] = [];

  constructor(document: Document, maxHistorySize: number = 100) {
    this.document = document;
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * コマンドを実行してヒストリーに追加
   */
  execute(command: ICommand): void {
    try {
      // コマンドを実行
      command.execute(this.document);

      // ヒストリーに追加
      const entry: HistoryEntry = {
        command,
        timestamp: new Date(),
      };

      this.undoStack.push(entry);

      // スタックサイズ制限
      if (this.undoStack.length > this.maxHistorySize) {
        this.undoStack.shift();
      }

      // redo スタックをクリア
      this.redoStack = [];

      this.notifyChange({
        type: 'execute',
        command,
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoStackSize: this.undoStack.length,
        redoStackSize: this.redoStack.length,
      });
    } catch (error) {
      console.error('Failed to execute command:', error);
      throw error;
    }
  }

  /**
   * Undo操作
   */
  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    const entry = this.undoStack.pop()!;
    if (!entry.command.canUndo()) {
      return false;
    }

    try {
      entry.command.undo(this.document);
      this.redoStack.push(entry);

      this.notifyChange({
        type: 'undo',
        command: entry.command,
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoStackSize: this.undoStack.length,
        redoStackSize: this.redoStack.length,
      });

      return true;
    } catch (error) {
      console.error('Failed to undo command:', error);
      // エラーが発生した場合は元に戻す
      this.undoStack.push(entry);
      return false;
    }
  }

  /**
   * Redo操作
   */
  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }

    const entry = this.redoStack.pop()!;

    try {
      entry.command.execute(this.document);
      this.undoStack.push(entry);

      this.notifyChange({
        type: 'redo',
        command: entry.command,
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoStackSize: this.undoStack.length,
        redoStackSize: this.redoStack.length,
      });

      return true;
    } catch (error) {
      console.error('Failed to redo command:', error);
      // エラーが発生した場合は元に戻す
      this.redoStack.push(entry);
      return false;
    }
  }

  /**
   * ヒストリーをクリア
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];

    this.notifyChange({
      type: 'clear',
      canUndo: false,
      canRedo: false,
      undoStackSize: 0,
      redoStackSize: 0,
    });
  }

  /**
   * Undo可能かどうか
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Redo可能かどうか
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * 現在のヒストリー状態を取得
   */
  getState() {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
      nextUndoCommand:
        this.undoStack.length > 0
          ? this.undoStack[this.undoStack.length - 1].command
          : null,
      nextRedoCommand:
        this.redoStack.length > 0
          ? this.redoStack[this.redoStack.length - 1].command
          : null,
    };
  }

  /**
   * Undoスタックの内容を取得（デバッグ用）
   */
  getUndoStack(): HistoryEntry[] {
    return [...this.undoStack];
  }

  /**
   * Redoスタックの内容を取得（デバッグ用）
   */
  getRedoStack(): HistoryEntry[] {
    return [...this.redoStack];
  }

  /**
   * 変更リスナーを追加
   */
  addChangeListener(listener: (event: HistoryChangeEvent) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * 変更リスナーを削除
   */
  removeChangeListener(listener: (event: HistoryChangeEvent) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index !== -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * 変更通知
   */
  private notifyChange(event: HistoryChangeEvent): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in history change listener:', error);
      }
    });
  }

  /**
   * ヒストリーサイズの上限を設定
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(1, size);

    // 既存のスタックもサイズ制限を適用
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack = this.undoStack.slice(-this.maxHistorySize);
    }
  }

  /**
   * ヒストリーサイズの上限を取得
   */
  getMaxHistorySize(): number {
    return this.maxHistorySize;
  }
}
