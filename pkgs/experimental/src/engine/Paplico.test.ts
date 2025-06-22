import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockCanvas } from '../../test/mock-globals'
import { BaseCommand } from './commands'
import { PaplicoEngine } from './paplico'

describe('PaplicoEngine', () => {
  let engine: PaplicoEngine
  let mockCanvas: HTMLCanvasElement

  beforeEach(async () => {
    mockCanvas = new MockCanvas() as any
    engine = new PaplicoEngine(mockCanvas)

    // Mock successful WebGPU initialization
    vi.spyOn(engine.getWebGPUEngine(), 'initialize').mockResolvedValue(true)

    await engine.initialize()
  })

  afterEach(() => {
    engine.dispose()
    vi.clearAllMocks()
  })

  describe('ドキュメント管理', () => {
    it('新しいドキュメントを作成できる', () => {
      const docId = engine.documentManager.createDocument({
        name: 'Test Document',
      })

      expect(docId).toBeDefined()
      expect(typeof docId).toBe('string')

      const document = engine.getActiveDocument()
      expect(document).toBeDefined()
      expect(document?.name).toBe('Test Document')
    })

    it('アクティブドキュメントを設定できる', () => {
      const doc1Id = engine.documentManager.createDocument({ name: 'Doc 1' })
      const _doc2Id = engine.documentManager.createDocument({ name: 'Doc 2' })

      engine.setActiveDocument(doc1Id)
      expect(engine.getActiveDocument()?.name).toBe('Doc 1')
    })

    it('ドキュメントを閉じることができる', () => {
      const doc1Id = engine.documentManager.createDocument({ name: 'Doc 1' })
      const _doc2Id = engine.documentManager.createDocument({ name: 'Doc 2' })

      expect(engine.documentManager.getAllDocuments().length).toBe(2)

      engine.documentManager.closeDocument(doc1Id)
      expect(engine.documentManager.getAllDocuments().length).toBe(1)
      expect(engine.getActiveDocument()?.name).toBe('Doc 2')
    })

    it('すべてのドキュメントを取得できる', () => {
      engine.documentManager.createDocument({ name: 'Doc 1' })
      engine.documentManager.createDocument({ name: 'Doc 2' })
      engine.documentManager.createDocument({ name: 'Doc 3' })

      const allDocs = engine.documentManager.getAllDocuments()
      expect(allDocs.length).toBe(3)
      expect(allDocs.map((d) => d.document.name)).toEqual([
        'Doc 1',
        'Doc 2',
        'Doc 3',
      ])
    })
  })

  describe('キャッシュ管理', () => {
    it('ドキュメントキャッシュを取得できる', () => {
      const docId = engine.documentManager.createDocument({ name: 'Test Doc' })
      const cache = engine.documentManager.getDocumentCache(docId)

      expect(cache).toBeDefined()
      expect(cache?.renderCache).toBeInstanceOf(Map)
      expect(cache?.bufferCache).toBeInstanceOf(Map)
      expect(cache?.geometryCache).toBeInstanceOf(Map)
      expect(cache?.filterCache).toBeInstanceOf(Map)
    })

    it('ドキュメントキャッシュをクリアできる', () => {
      const docId = engine.documentManager.createDocument({ name: 'Test Doc' })
      const cache = engine.documentManager.getDocumentCache(docId)!

      // Add some mock data
      cache.renderCache.set('test', 'data')
      cache.geometryCache.set('test', 'data')

      engine.documentManager.clearDocumentCache(docId)

      expect(cache.renderCache.size).toBe(0)
      expect(cache.geometryCache.size).toBe(0)
    })

    it('すべてのキャッシュをクリアできる', () => {
      const doc1Id = engine.documentManager.createDocument({ name: 'Doc 1' })
      const doc2Id = engine.documentManager.createDocument({ name: 'Doc 2' })

      const cache1 = engine.documentManager.getDocumentCache(doc1Id)!
      const cache2 = engine.documentManager.getDocumentCache(doc2Id)!

      cache1.renderCache.set('test1', 'data')
      cache2.renderCache.set('test2', 'data')

      // Verify data was added
      expect(cache1.renderCache.size).toBe(1)
      expect(cache2.renderCache.size).toBe(1)

      // Clear all caches
      engine.documentManager.clearAllDocumentCaches()

      expect(cache1.renderCache.size).toBe(0)
      expect(cache2.renderCache.size).toBe(0)
    })
  })

  describe('履歴統合', () => {
    it('コマンドを実行できる', () => {
      engine.documentManager.createDocument({ name: 'Test Document' })

      const mockCommand = new (class extends BaseCommand {
        type = 'mockCommand'
        execute = vi.fn()
        undo = vi.fn()
        canUndo = vi.fn(() => true)
        getDescription = vi.fn(() => 'Mock Command')
      })()

      const result = engine.executeCommand(mockCommand)

      expect(result).toBe(true)
      expect(mockCommand.execute).toHaveBeenCalled()
    })

    it('アンドゥ操作を実行できる', () => {
      engine.documentManager.createDocument({ name: 'Test Document' })

      const mockCommand = new (class extends BaseCommand {
        type = 'mockCommand'
        execute = vi.fn()
        undo = vi.fn()
        canUndo = vi.fn(() => true)
        getDescription = vi.fn(() => 'Mock Command')
      })()

      engine.executeCommand(mockCommand)
      const undoResult = engine.undo()

      expect(undoResult).toBe(true)
    })

    it('リドゥ操作を実行できる', () => {
      engine.documentManager.createDocument({ name: 'Test Document' })

      const mockCommand = new (class extends BaseCommand {
        type = 'mockCommand'
        execute = vi.fn()
        undo = vi.fn()
        canUndo = vi.fn(() => true)
        getDescription = vi.fn(() => 'Mock Command')
      })()

      engine.executeCommand(mockCommand)
      engine.undo()
      const redoResult = engine.redo()

      expect(redoResult).toBe(true)
    })

    it('履歴状態を取得できる', () => {
      engine.documentManager.createDocument({ name: 'Test Document' })

      const historyState = engine.getHistoryState()

      expect(historyState).toBeDefined()
      expect(historyState?.canUndo).toBe(false)
      expect(historyState?.canRedo).toBe(false)
    })

    it('アクティブドキュメントがない場合は履歴操作でfalseを返す', () => {
      // Close all documents
      const docs = engine.documentManager.getAllDocuments()
      docs.forEach(({ id }) => engine.documentManager.closeDocument(id))

      const mockCommand = new (class extends BaseCommand {
        type = 'mockCommand'
        execute = vi.fn()
        undo = vi.fn()
        canUndo = vi.fn(() => true)
        getDescription = vi.fn(() => 'Mock Command')
      })()

      expect(engine.executeCommand(mockCommand)).toBe(false)
      expect(engine.undo()).toBe(false)
      expect(engine.redo()).toBe(false)
      expect(engine.getHistoryState()).toBe(null)
    })
  })

  describe('ドキュメント状態管理', () => {
    it('ドキュメントを保存済みとしてマークできる', () => {
      const docId = engine.documentManager.createDocument({
        name: 'Test Document',
      })
      const context = engine.getDocumentManager().getDocumentContext(docId)!

      context.isDirty = true

      engine.markDocumentAsSaved(docId)

      expect(context.isDirty).toBe(false)
      expect(context.lastSaved).toBeInstanceOf(Date)
    })

    it('IDが提供されない場合はアクティブドキュメントを保存済みとしてマークする', () => {
      engine.documentManager.createDocument({ name: 'Active Document' })
      const activeDoc = engine.getActiveDocument()!
      const context = engine
        .getDocumentManager()
        .getDocumentContext(activeDoc.id)!

      context.isDirty = true

      engine.markDocumentAsSaved()

      expect(context.isDirty).toBe(false)
      expect(context.lastSaved).toBeInstanceOf(Date)
    })

    it('存在しないドキュメントを保存済みとしてマークする処理を適切に扱う', () => {
      // Should not throw error
      engine.markDocumentAsSaved('non-existent-id' as any)
    })
  })
})
