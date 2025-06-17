import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { PaplicoEngine } from './paplico'
import { DocumentSerializer } from './document/serialization'

// Mock canvas and WebGPU
const createMockCanvas = () =>
  ({
    width: 800,
    height: 600,
    getContext: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    style: {},
  }) as any

// Mock WebGPU
Object.defineProperty(global, 'navigator', {
  writable: true,
  value: {
    gpu: {
      requestAdapter: vi.fn(() =>
        Promise.resolve({
          requestDevice: vi.fn(() =>
            Promise.resolve({
              createBuffer: vi.fn(),
              createTexture: vi.fn(),
              createShaderModule: vi.fn(),
              createRenderPipeline: vi.fn(),
              createCommandEncoder: vi.fn(),
              queue: {
                submit: vi.fn(),
                writeBuffer: vi.fn(),
              },
            }),
          ),
        }),
      ),
    },
  },
})

// Mock File APIs
global.File = class MockFile {
  constructor(
    public parts: any[],
    public name: string,
    public options: any,
  ) {
    this.size = parts.reduce((size, part) => size + (part.length || 0), 0)
  }
  size: number
} as any

global.FileReader = class MockFileReader {
  onload: ((event: any) => void) | null = null
  onerror: (() => void) | null = null

  readAsArrayBuffer(file: File) {
    setTimeout(() => {
      if (this.onload) {
        const buffer = new ArrayBuffer(8)
        this.onload({ target: { result: buffer } })
      }
    }, 0)
  }
} as any

global.Blob = class MockBlob {
  constructor(
    public parts: any[],
    public options: any,
  ) {}
} as any

global.URL = {
  createObjectURL: vi.fn(() => 'mock-url'),
  revokeObjectURL: vi.fn(),
} as any

describe('PaplicoEngine File I/O', () => {
  let engine: PaplicoEngine
  let mockCanvas: HTMLCanvasElement

  beforeEach(async () => {
    // Mock window for InputManager
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any

    mockCanvas = createMockCanvas()
    engine = new PaplicoEngine(mockCanvas)

    // Mock successful WebGPU initialization
    vi.spyOn(engine.getWebGPUEngine(), 'initialize').mockResolvedValue(true)

    await engine.initialize()
  })

  afterEach(() => {
    engine.dispose()
    vi.clearAllMocks()
  })

  describe('Document Management', () => {
    it('should create new document', () => {
      const docId = engine.documentManager.createDocument({
        name: 'Test Document',
      })

      expect(docId).toBeDefined()
      expect(typeof docId).toBe('string')

      const document = engine.getActiveDocument()
      expect(document).toBeDefined()
      expect(document?.name).toBe('Test Document')
    })

    it('should set active document', () => {
      const doc1Id = engine.createDocument({ name: 'Doc 1' })
      const doc2Id = engine.createDocument({ name: 'Doc 2' })

      expect(engine.getActiveDocument()?.name).toBe('Doc 2') // Latest created is active

      engine.setActiveDocument(doc1Id)
      expect(engine.getActiveDocument()?.name).toBe('Doc 1')
    })

    it('should close document', () => {
      const doc1Id = engine.createDocument({ name: 'Doc 1' })
      const doc2Id = engine.createDocument({ name: 'Doc 2' })

      expect(engine.getAllDocuments().length).toBe(2)

      engine.closeDocument(doc1Id)
      expect(engine.getAllDocuments().length).toBe(1)
      expect(engine.getActiveDocument()?.name).toBe('Doc 2')
    })

    it('should get all documents', () => {
      engine.createDocument({ name: 'Doc 1' })
      engine.createDocument({ name: 'Doc 2' })
      engine.createDocument({ name: 'Doc 3' })

      const allDocs = engine.getAllDocuments()
      expect(allDocs.length).toBe(3)
      expect(allDocs.map((d) => d.document.name)).toEqual([
        'Doc 1',
        'Doc 2',
        'Doc 3',
      ])
    })
  })

  describe('Cache Management', () => {
    it('should get document cache', () => {
      const docId = engine.createDocument({ name: 'Test Doc' })
      const cache = engine.getDocumentCache(docId)

      expect(cache).toBeDefined()
      expect(cache?.renderCache).toBeInstanceOf(Map)
      expect(cache?.bufferCache).toBeInstanceOf(Map)
      expect(cache?.geometryCache).toBeInstanceOf(Map)
      expect(cache?.filterCache).toBeInstanceOf(Map)
    })

    it('should clear document cache', () => {
      const docId = engine.createDocument({ name: 'Test Doc' })
      const cache = engine.getDocumentCache(docId)!

      // Add some mock data
      cache.renderCache.set('test', 'data')
      cache.geometryCache.set('test', 'data')

      engine.clearDocumentCache(docId)

      expect(cache.renderCache.size).toBe(0)
      expect(cache.geometryCache.size).toBe(0)
    })

    it('should clear all caches', () => {
      const doc1Id = engine.createDocument({ name: 'Doc 1' })
      const doc2Id = engine.createDocument({ name: 'Doc 2' })

      const cache1 = engine.getDocumentCache(doc1Id)!
      const cache2 = engine.getDocumentCache(doc2Id)!

      cache1.renderCache.set('test1', 'data')
      cache2.renderCache.set('test2', 'data')

      engine.clearAllDocumentCaches()

      expect(cache1.renderCache.size).toBe(0)
      expect(cache2.renderCache.size).toBe(0)
    })
  })

  describe('File Serialization', () => {
    beforeEach(() => {
      // Mock DOM for file operations
      global.document = {
        ...global.document,
        createElement: vi.fn((tag: string) => {
          if (tag === 'a') {
            return {
              href: '',
              download: '',
              style: { display: '' },
              click: vi.fn(),
            }
          }
          if (tag === 'input') {
            return {
              type: '',
              accept: '',
              style: { display: '' },
              onchange: null,
              files: null,
              click: vi.fn(),
            }
          }
          return {}
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      } as any
    })

    it('should serialize active document', () => {
      engine.createDocument({ name: 'Test Document' })

      const serialized = engine.serializeActiveDocument()

      expect(serialized).toBeInstanceOf(Uint8Array)
      expect(serialized.length).toBeGreaterThan(0)
    })

    it('should throw error when no active document for serialization', () => {
      // Close all documents
      const docs = engine.getAllDocuments()
      docs.forEach(({ id }) => engine.closeDocument(id))

      expect(() => engine.serializeActiveDocument()).toThrow(
        'No active document to serialize',
      )
    })

    it('should deserialize document', () => {
      engine.createDocument({ name: 'Original Document' })
      const originalDoc = engine.getActiveDocument()!

      const serialized = engine.serializeActiveDocument()
      const newDocId = engine.deserializeDocument(serialized)

      expect(newDocId).toBeDefined()
      const restoredDoc = engine.getActiveDocument()!
      expect(restoredDoc.name).toBe(originalDoc.name)
      expect(restoredDoc.id).toBe(originalDoc.id)
    })

    it('should estimate document file size', () => {
      engine.createDocument({ name: 'Test Document' })

      const size = engine.estimateDocumentFileSize()

      expect(typeof size).toBe('number')
      expect(size).toBeGreaterThan(0)
    })

    it('should estimate file size for specific document', () => {
      const docId = engine.createDocument({ name: 'Test Document' })

      const size = engine.estimateDocumentFileSize(docId)

      expect(typeof size).toBe('number')
      expect(size).toBeGreaterThan(0)
    })

    it('should return 0 for non-existent document file size', () => {
      const size = engine.estimateDocumentFileSize('non-existent-id' as any)
      expect(size).toBe(0)
    })
  })

  describe('File Save Operations', () => {
    beforeEach(() => {
      global.document = {
        ...global.document,
        createElement: vi.fn(() => ({
          href: '',
          download: '',
          style: { display: '' },
          click: vi.fn(),
        })),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      } as any
    })

    it('should save document to file', () => {
      engine.createDocument({ name: 'Test Document' })

      const createElementSpy = vi.spyOn(global.document, 'createElement')

      engine.saveDocumentToFile('custom-name.paplico')

      expect(createElementSpy).toHaveBeenCalled()
    })

    it('should save specific document to file', () => {
      const docId = engine.createDocument({ name: 'Test Document' })

      const createElementSpy = vi.spyOn(global.document, 'createElement')

      engine.saveSpecificDocumentToFile(docId, 'specific-doc.paplico')

      expect(createElementSpy).toHaveBeenCalled()
    })

    it('should throw error when saving non-existent document', () => {
      expect(() => {
        engine.saveSpecificDocumentToFile('non-existent-id' as any)
      }).toThrow('Document with ID non-existent-id not found')
    })

    it('should throw error when no active document to save', () => {
      // Close all documents
      const docs = engine.getAllDocuments()
      docs.forEach(({ id }) => engine.closeDocument(id))

      expect(() => engine.saveDocumentToFile()).toThrow(
        'No active document to save',
      )
    })

    it('should mark document as saved after save', () => {
      const docId = engine.createDocument({ name: 'Test Document' })
      const context = engine.getDocumentManager().getDocumentContext(docId)!

      // Mark as dirty first
      context.isDirty = true

      engine.saveDocumentToFile()

      expect(context.isDirty).toBe(false)
      expect(context.lastSaved).toBeInstanceOf(Date)
    })
  })

  describe('File Load Operations', () => {
    let mockFile: File

    beforeEach(() => {
      // Create a mock file with valid document data
      const testDoc = engine.createDocument({ name: 'Mock Document' })
      const serialized = engine.serializeActiveDocument()

      mockFile = new File([serialized], 'test.paplico', {
        type: 'application/x-paplico-project',
      })

      global.document = {
        ...global.document,
        createElement: vi.fn((tag: string) => {
          if (tag === 'input') {
            return {
              type: '',
              accept: '',
              style: { display: '' },
              onchange: null as any,
              files: [mockFile],
              click: vi.fn(function (this: any) {
                if (this.onchange) {
                  this.onchange({ target: this })
                }
              }),
            }
          }
          return {}
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      } as any
    })

    it('should load document from file object', async () => {
      const initialDocCount = engine.getAllDocuments().length

      const newDocId = await engine.loadDocumentFromFile(mockFile)

      expect(newDocId).toBeDefined()
      expect(engine.getAllDocuments().length).toBe(initialDocCount + 1)
      expect(engine.getActiveDocument()?.name).toBe('Mock Document')
    })

    it('should open document from file dialog', async () => {
      const initialDocCount = engine.getAllDocuments().length

      const newDocId = await engine.openDocumentFromFile()

      expect(newDocId).toBeDefined()
      expect(engine.getAllDocuments().length).toBe(initialDocCount + 1)
    })

    it('should handle file load errors', async () => {
      // Mock FileReader to simulate error
      global.FileReader = class {
        onload: ((event: any) => void) | null = null
        onerror: (() => void) | null = null

        readAsArrayBuffer() {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror()
            }
          }, 0)
        }
      } as any

      await expect(engine.loadDocumentFromFile(mockFile)).rejects.toThrow()
    })
  })

  describe('History Integration', () => {
    it('should execute commands', () => {
      engine.createDocument({ name: 'Test Document' })

      const mockCommand = {
        execute: vi.fn(),
        undo: vi.fn(),
        canUndo: vi.fn(() => true),
        getDescription: vi.fn(() => 'Mock Command'),
      }

      const result = engine.executeCommand(mockCommand)

      expect(result).toBe(true)
      expect(mockCommand.execute).toHaveBeenCalled()
    })

    it('should perform undo operation', () => {
      engine.createDocument({ name: 'Test Document' })

      const mockCommand = {
        execute: vi.fn(),
        undo: vi.fn(),
        canUndo: vi.fn(() => true),
        getDescription: vi.fn(() => 'Mock Command'),
      }

      engine.executeCommand(mockCommand)
      const undoResult = engine.undo()

      expect(undoResult).toBe(true)
    })

    it('should perform redo operation', () => {
      engine.createDocument({ name: 'Test Document' })

      const mockCommand = {
        execute: vi.fn(),
        undo: vi.fn(),
        canUndo: vi.fn(() => true),
        getDescription: vi.fn(() => 'Mock Command'),
      }

      engine.executeCommand(mockCommand)
      engine.undo()
      const redoResult = engine.redo()

      expect(redoResult).toBe(true)
    })

    it('should get history state', () => {
      engine.createDocument({ name: 'Test Document' })

      const historyState = engine.getHistoryState()

      expect(historyState).toBeDefined()
      expect(historyState?.canUndo).toBe(false)
      expect(historyState?.canRedo).toBe(false)
    })

    it('should return false for history operations without active document', () => {
      // Close all documents
      const docs = engine.getAllDocuments()
      docs.forEach(({ id }) => engine.closeDocument(id))

      const mockCommand = {
        execute: vi.fn(),
        undo: vi.fn(),
        canUndo: vi.fn(() => true),
        getDescription: vi.fn(() => 'Mock Command'),
      }

      expect(engine.executeCommand(mockCommand)).toBe(false)
      expect(engine.undo()).toBe(false)
      expect(engine.redo()).toBe(false)
      expect(engine.getHistoryState()).toBe(null)
    })
  })

  describe('Document State Management', () => {
    it('should mark document as saved', () => {
      const docId = engine.createDocument({ name: 'Test Document' })
      const context = engine.getDocumentManager().getDocumentContext(docId)!

      context.isDirty = true

      engine.markDocumentAsSaved(docId)

      expect(context.isDirty).toBe(false)
      expect(context.lastSaved).toBeInstanceOf(Date)
    })

    it('should mark active document as saved when no ID provided', () => {
      engine.createDocument({ name: 'Active Document' })
      const activeDoc = engine.getActiveDocument()!
      const context = engine
        .getDocumentManager()
        .getDocumentContext(activeDoc.id)!

      context.isDirty = true

      engine.markDocumentAsSaved()

      expect(context.isDirty).toBe(false)
      expect(context.lastSaved).toBeInstanceOf(Date)
    })

    it('should handle marking non-existent document as saved', () => {
      // Should not throw error
      engine.markDocumentAsSaved('non-existent-id' as any)
    })
  })
})
