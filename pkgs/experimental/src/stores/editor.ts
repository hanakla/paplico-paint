import { proxy } from 'valtio'
import { PaplicoEngine } from '@/engine/paplico'
import { Document } from '@/engine/document/document'
import { UUID } from '@/engine/document/types'

/**
 * エディター状態管理
 */
export interface EditorState {
  activeDocumentId: UUID | null
  /** PaplicoEngineの参照 */
  engine: PaplicoEngine | null
  /** エンジンの初期化状態 */
  isInitialized: boolean
  /** WebGPUサポート状態 */
  isWebGPUSupported: boolean
}

export const editorState = proxy<EditorState>({
  activeDocumentId: null,
  engine: null,
  isInitialized: false,
  isWebGPUSupported: false,
})

/**
 * エンジンを設定
 */
export const setEngine = (engine: PaplicoEngine | null) => {
  editorState.engine = engine
  editorState.isInitialized = !!engine
}

/**
 * WebGPUサポート状態を設定
 */
export const setWebGPUSupported = (supported: boolean) => {
  editorState.isWebGPUSupported = supported
}

export const setActiveDocument = (id: UUID | null) => {
  editorState.activeDocumentId = id
  editorState.engine?.documentManager.setActiveDocument(id)
}

/**
 * アクティブドキュメントを取得
 */
export const getActiveDocument = (): Document | null => {
  if (!editorState.engine) return null
  return editorState.engine.documentManager.activeDocument
}

/**
 * エンジンでコマンドを実行
 */
export const executeCommand = (command: any): boolean => {
  if (!editorState.engine) return false
  return editorState.engine.executeCommand(command)
}

/**
 * Undo実行
 */
export const undo = (): boolean => {
  if (!editorState.engine) return false
  return editorState.engine.undo()
}

/**
 * Redo実行
 */
export const redo = (): boolean => {
  if (!editorState.engine) return false
  return editorState.engine.redo()
}

/**
 * Undoが可能かチェック
 */
export const canUndo = (): boolean => {
  if (!editorState.engine) return false
  const historyState = editorState.engine.getHistoryState()
  return historyState ? historyState.canUndo : false
}

/**
 * Redoが可能かチェック
 */
export const canRedo = (): boolean => {
  if (!editorState.engine) return false
  const historyState = editorState.engine.getHistoryState()
  return historyState ? historyState.canRedo : false
}

/**
 * レイヤー操作のヘルパー関数群
 */

/**
 * レイヤーの表示/非表示を切り替え
 */
export const toggleLayerVisibility = (layerId: UUID): void => {
  const document = getActiveDocument()
  if (document) {
    const layer = document.layers[layerId]
    if (layer) {
      layer.visible = !layer.visible
      document.updatedAt = new Date()
    }
  }
}

/**
 * レイヤーの不透明度を設定
 */
export const setLayerOpacity = (layerId: UUID, opacity: number): void => {
  const document = getActiveDocument()
  if (document) {
    const layer = document.layers[layerId]
    if (layer) {
      layer.opacity = Math.max(0, Math.min(1, opacity))
      document.updatedAt = new Date()
    }
  }
}

/**
 * アクティブレイヤーを設定
 */
export const setActiveLayer = (layerId: UUID): void => {
  if (editorState.engine) {
    editorState.engine.setActiveLayer(layerId)
  }
}
