import { Document, createDocument, CreateDocumentParams } from './document'
import { DocumentHistory, HistoryChangeEvent } from '../history/history'
import { ICommand } from '../history/command'
import { UUID } from './types'

/**
 * ドキュメントごのキャッシュデータ
 */
export interface DocumentCache {
  /** レンダリング用キャッシュテクスチャ */
  renderCache: Map<string, any>
  /** WebGPUバッファキャッシュ */
  bufferCache: Map<string, GPUBuffer>
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
export interface DocumentContext {
  /** ドキュメント */
  document: Document
  /** ヒストリー管理 */
  history: DocumentHistory
  /** キャッシュデータ */
  cache: DocumentCache
  /** 最終保存時刻 */
  lastSaved?: Date
  /** 変更フラグ */
  isDirty: boolean
}

/**
 * ドキュメント管理システム
 */
export class DocumentManager {
  private documents: Map<UUID, DocumentContext> = new Map()
  private activeDocumentId: UUID | null = null
  private changeListeners: ((event: DocumentManagerChangeEvent) => void)[] = []

  /**
   * 新しいドキュメントを作成
   */
  createDocument(params: CreateDocumentParams = {}): UUID {
    const document = createDocument(params)
    const history = new DocumentHistory(document)
    const cache = this.createEmptyCache()

    const context: DocumentContext = {
      document,
      history,
      cache,
      isDirty: false,
    }

    this.documents.set(document.id, context)

    // ヒストリー変更リスナーを設定
    history.addChangeListener((event) => {
      context.isDirty = true
      this.notifyChange({
        type: 'history-changed',
        documentId: document.id,
        historyEvent: event,
      })
    })

    // 最初のドキュメントの場合はアクティブに設定
    if (!this.activeDocumentId) {
      this.setActiveDocument(document.id)
    }

    this.notifyChange({
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
        this.notifyChange({
          type: 'active-document-changed',
          documentId: this.activeDocumentId,
        })
      }
    }

    this.notifyChange({
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
      this.notifyChange({
        type: 'active-document-changed',
        documentId,
      })
    }

    return true
  }

  /**
   * アクティブドキュメントを取得
   */
  getActiveDocument(): Document | null {
    if (!this.activeDocumentId) return null
    return this.documents.get(this.activeDocumentId)?.document || null
  }

  /**
   * アクティブドキュメントのコンテキストを取得
   */
  getActiveDocumentContext(): DocumentContext | null {
    if (!this.activeDocumentId) return null
    return this.documents.get(this.activeDocumentId) || null
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
  getDocumentContext(documentId: UUID): DocumentContext | null {
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
    const context = this.getActiveDocumentContext()
    if (!context) return false

    context.history.execute(command)
    return true
  }

  /**
   * アクティブドキュメントでUndo
   */
  undo(): boolean {
    const context = this.getActiveDocumentContext()
    if (!context) return false

    return context.history.undo()
  }

  /**
   * アクティブドキュメントでRedo
   */
  redo(): boolean {
    const context = this.getActiveDocumentContext()
    if (!context) return false

    return context.history.redo()
  }

  /**
   * ヒストリー状態を取得
   */
  getHistoryState(documentId?: UUID) {
    const context = documentId
      ? this.getDocumentContext(documentId)
      : this.getActiveDocumentContext()

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
  clearAllCaches(): void {
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

    this.notifyChange({
      type: 'document-saved',
      documentId,
    })
  }

  /**
   * 変更リスナーを追加
   */
  addChangeListener(
    listener: (event: DocumentManagerChangeEvent) => void,
  ): void {
    this.changeListeners.push(listener)
  }

  /**
   * 変更リスナーを削除
   */
  removeChangeListener(
    listener: (event: DocumentManagerChangeEvent) => void,
  ): void {
    const index = this.changeListeners.indexOf(listener)
    if (index !== -1) {
      this.changeListeners.splice(index, 1)
    }
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
   * 変更通知
   */
  private notifyChange(event: DocumentManagerChangeEvent): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in document manager change listener:', error)
      }
    })
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    this.clearAllCaches()
    this.documents.clear()
    this.changeListeners = []
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
