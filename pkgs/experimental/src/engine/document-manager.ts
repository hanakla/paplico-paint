import { Emitter } from '@paplico/shared-lib'
import {
  type CreateDocumentParams,
  createDocument,
  type Document,
} from './document'
import type { UUID } from './document/types'
import type { ICommand } from './history/command'
import { DocumentHistory, type HistoryChangeEvent } from './history/history'

/**
 * ドキュメントごのキャッシュデータ
 */
export interface DocumentCache {
  /** レンダリング用キャッシュテクスチャ */
  renderCache: Map<string, any>
  /** WebGPUバッファキャッシュ */
  bufferCache: Map<string, GPUBuffer> // GPUBuffer型エラーを回避
  /** ジオメトリキャッシュ */
  geometryCache: Map<string, any>
  /** フィルター結果キャッシュ */
  filterCache: Map<string, any>
  /** 最終アクセス時刻 */
  lastAccessed: Date
}

/**
 * ドキュメントコンテキスト
 */
export class DocumentContext {
  /** 最終保存時刻 */
  public lastSaved?: Date
  /** 変更フラグ */
  public isDirty: boolean = false

  constructor(
    /** ドキュメント */
    public document: Document,
    /** ヒストリー管理 */
    public history: DocumentHistory,
    /** キャッシュデータ */
    public cache: DocumentCache,
  ) {}
}

/**
 * ドキュメント管理システム
 */
export class DocumentManager extends Emitter<DocumentManagerEvents> {
  private documents: Map<UUID, DocumentContext> = new Map()
  private activeDocumentId: UUID | null = null

  /**
   * ドキュメントを読み込む
   */
  public loadDocument(document: Document) {
    const history = new DocumentHistory(document)
    const context: DocumentContext = new DocumentContext(
      document,
      history,
      this.createEmptyCache(),
    )

    this.documents.set(document.id, context)
    this.emit('documentCreated', {
      type: 'document-created',
      documentId: document.id,
    })

    history.addChangeListener((event: HistoryChangeEvent) => {
      context.isDirty = true
      this.emit('historyChanged', {
        type: 'history-changed',
        documentId: document.id,
        historyEvent: event,
      })
    })

    if (!this.activeDocumentId) {
      this.setActiveDocument(document.id)
    }

    this.emit('documentLoaded', {
      type: 'document-loaded',
      documentId: document.id,
    })

    return document.id
  }

  /**
   * 新しいドキュメントを作成
   */
  createDocument(params: CreateDocumentParams = {}): UUID {
    const document = createDocument(params)
    const history = new DocumentHistory(document)
    const cache = this.createEmptyCache()

    const context: DocumentContext = new DocumentContext(
      document,
      history,
      cache,
    )

    this.documents.set(document.id, context)

    // ヒストリー変更リスナーを設定
    history.addChangeListener((event) => {
      context.isDirty = true
      this.emit('historyChanged', {
        type: 'history-changed',
        documentId: document.id,
        historyEvent: event,
      })
    })

    // 最初のドキュメントの場合はアクティブに設定
    if (!this.activeDocumentId) {
      this.setActiveDocument(document.id)
    }

    this.emit('documentCreated', {
      type: 'document-created',
      documentId: document.id,
    })

    return document.id
  }

  /**
   * ドキュメントを閉じる
   */
  closeDocument(documentId: UUID): boolean {
    const context = this.documents.get(documentId)
    if (!context) return false

    // キャッシュをクリーンアップ
    this.clearDocumentCache(documentId)

    this.documents.delete(documentId)

    // アクティブドキュメントが閉じられた場合
    if (this.activeDocumentId === documentId) {
      const remainingDocuments = Array.from(this.documents.keys())
      this.activeDocumentId =
        remainingDocuments.length > 0 ? remainingDocuments[0] : null

      if (this.activeDocumentId) {
        this.emit('activeDocumentChanged', {
          type: 'active-document-changed',
          documentId: this.activeDocumentId,
        })
      }
    }

    this.emit('documentClosed', {
      type: 'document-closed',
      documentId,
    })

    return true
  }

  /**
   * アクティブドキュメントを設定
   */
  setActiveDocument(documentId: UUID | null): boolean {
    if (documentId && !this.documents.has(documentId)) {
      return false
    }

    const previousId = this.activeDocumentId
    this.activeDocumentId = documentId

    // キャッシュアクセス時刻を更新
    if (documentId) {
      const context = this.documents.get(documentId)!
      context.cache.lastAccessed = new Date()
    }

    if (previousId !== documentId) {
      this.emit('activeDocumentChanged', {
        type: 'active-document-changed',
        documentId,
      })
    }

    return true
  }

  /**
   * アクティブドキュメントを取得
   */
  get activeDocument(): Document | null {
    if (!this.activeDocumentId) return null
    return this.documents.get(this.activeDocumentId)?.document || null
  }

  /**
   * ドキュメントを取得
   */
  getDocument(documentId: UUID): Document | null {
    return this.documents.get(documentId)?.document || null
  }

  /**
   * ドキュメントコンテキストを取得
   */
  getDocumentContext(documentId: UUID | null): DocumentContext | null {
    if (!documentId) return null
    return this.documents.get(documentId) || null
  }

  /**
   * 全ドキュメントのリストを取得
   */
  getAllDocuments(): Array<{ id: UUID; document: Document; isDirty: boolean }> {
    return Array.from(this.documents.entries()).map(([id, context]) => ({
      id,
      document: context.document,
      isDirty: context.isDirty,
    }))
  }

  /**
   * アクティブドキュメントでコマンドを実行
   */
  executeCommand(command: ICommand): boolean {
    const context = this.getDocumentContext(this.activeDocumentId)
    if (!context) return false

    context.history.execute(command)
    return true
  }

  /**
   * アクティブドキュメントでUndo
   */
  undo(): boolean {
    const context = this.getDocumentContext(this.activeDocumentId)
    if (!context) return false

    return context.history.undo()
  }

  /**
   * アクティブドキュメントでRedo
   */
  redo(): boolean {
    const context = this.getDocumentContext(this.activeDocumentId)
    if (!context) return false

    return context.history.redo()
  }

  /**
   * ヒストリー状態を取得
   */
  getHistoryState(documentId: UUID) {
    const context = this.getDocumentContext(documentId)

    if (!context) return null
    return context.history.getState()
  }

  /**
   * ドキュメントキャッシュを取得
   */
  getDocumentCache(documentId: UUID): DocumentCache | null {
    const context = this.documents.get(documentId)
    if (!context) return null

    context.cache.lastAccessed = new Date()
    return context.cache
  }

  /**
   * ドキュメントキャッシュをクリア
   */
  clearDocumentCache(documentId: UUID): void {
    const context = this.documents.get(documentId)
    if (!context) return

    // GPUバッファを破棄
    context.cache.bufferCache.forEach((buffer) => {
      try {
        buffer.destroy()
      } catch (error) {
        console.warn('Failed to destroy buffer:', error)
      }
    })

    // キャッシュをクリア
    context.cache.renderCache.clear()
    context.cache.bufferCache.clear()
    context.cache.geometryCache.clear()
    context.cache.filterCache.clear()
  }

  /**
   * 全ドキュメントのキャッシュをクリア
   */
  clearAllDocumentCaches(): void {
    this.documents.forEach((_, documentId) => {
      this.clearDocumentCache(documentId)
    })
  }

  /**
   * ドキュメントを保存済みとしてマーク
   */
  markDocumentAsSaved(documentId: UUID): void {
    const context = this.documents.get(documentId)
    if (!context) return

    context.isDirty = false
    context.lastSaved = new Date()

    this.emit('documentSaved', {
      type: 'document-saved',
      documentId,
    })
  }

  /**
   * 空のキャッシュを作成
   */
  private createEmptyCache(): DocumentCache {
    return {
      renderCache: new Map(),
      bufferCache: new Map(),
      geometryCache: new Map(),
      filterCache: new Map(),
      lastAccessed: new Date(),
    }
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    this.clearAllDocumentCaches()
    this.documents.clear()
    // 各イベントタイプのリスナーを削除
    this.off('documentCreated')
    this.off('documentClosed')
    this.off('activeDocumentChanged')
    this.off('documentSaved')
    this.off('historyChanged')
    this.activeDocumentId = null
  }
}

/**
 * ドキュメントマネージャー変更イベント
 */
export interface DocumentManagerChangeEvent {
  type:
    | 'document-created'
    | 'document-closed'
    | 'active-document-changed'
    | 'document-saved'
    | 'history-changed'
  documentId: UUID | null
  historyEvent?: HistoryChangeEvent
}

/**
 * DocumentManagerのイベント型定義
 */
export interface DocumentManagerEvents
  extends Record<string | symbol, unknown> {
  documentCreated: DocumentManagerChangeEvent
  documentClosed: DocumentManagerChangeEvent
  activeDocumentChanged: DocumentManagerChangeEvent
  documentSaved: DocumentManagerChangeEvent
  historyChanged: DocumentManagerChangeEvent
}
