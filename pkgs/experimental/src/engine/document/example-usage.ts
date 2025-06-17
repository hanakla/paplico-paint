/**
 * ドキュメント管理・ヒストリー機能の使用例
 *
 * このファイルは実装した機能の使用方法を示すサンプルコードです。
 */

import { PaplicoEngine } from '../Paplico'
import { AddLayerCommand, UpdateLayerCommand } from '../history/command'
import { createLayer } from './layer'

// 使用例: 複数ドキュメント管理とUndo/Redoヒストリー
export function exampleUsage() {
  // Paplicoエンジンを初期化（実際の使用では既存のcanvas要素を使用）
  const canvas = document.createElement('canvas')
  const paplico = new PaplicoEngine(canvas)

  // === ドキュメント管理の例 ===

  // 新しいドキュメントを作成
  const doc1Id = paplico.createDocument({
    name: 'マイプロジェクト 1',
    initialArtboard: { width: 1920, height: 1080 },
  })

  const doc2Id = paplico.createDocument({
    name: 'マイプロジェクト 2',
    initialArtboard: { width: 1280, height: 720 },
  })

  // アクティブドキュメントを切り替え
  paplico.setActiveDocument(doc1Id)

  // 全ドキュメントのリストを取得
  const allDocs = paplico.getAllDocuments()

  // === ヒストリー管理の例 ===

  // レイヤーを追加するコマンドを実行
  const newLayer = createLayer('vector', 'レイヤー1')
  const addLayerCommand = new AddLayerCommand({
    layerId: newLayer.id,
    layerData: newLayer,
    parentId: null,
  })

  // コマンドを実行（自動的にヒストリーに追加される）
  paplico.executeCommand(addLayerCommand)

  // レイヤーの透明度を変更
  const updateCommand = new UpdateLayerCommand({
    layerId: newLayer.id,
    changes: { opacity: 0.5, visible: true },
  })
  paplico.executeCommand(updateCommand)

  // Undo/Redo操作
  paplico.undo() // 透明度変更を取り消し

  paplico.redo() // 透明度変更を再実行

  // === キャッシュ管理の例 ===

  // ドキュメント固有のキャッシュを取得
  const cache = paplico.getDocumentCache(doc1Id)
  if (cache) {
    // レンダリング結果をキャッシュ
    cache.renderCache.set('layer_' + newLayer.id, {
      /* レンダリング結果 */
    })

    // ジオメトリデータをキャッシュ
    cache.geometryCache.set('triangulated_' + newLayer.id, {
      /* 三角分割結果 */
    })
  }

  // ドキュメント切り替え時にキャッシュは自動的に管理される
  paplico.setActiveDocument(doc2Id)

  // 必要に応じてキャッシュをクリア
  paplico.clearDocumentCache(doc1Id)

  // === ヒストリー変更の監視 ===

  // ヒストリー変更イベントをリッスン
  paplico.addHistoryChangeListener((event) => {
    // UIのUndo/Redoボタンの状態を更新
    updateUndoRedoButtons(event.canUndo, event.canRedo)
  })

  // ドキュメント保存状態を管理
  paplico.getDocumentManager().addChangeListener((event) => {
    if (event.type === 'history-changed') {
      // ドキュメントが変更されたことをUIに通知
    }
  })

  // リソースのクリーンアップ
  // paplico.dispose()
}

function updateUndoRedoButtons(canUndo: boolean, canRedo: boolean) {
  // UIボタンの状態を更新する処理
}

// === カスタムコマンドの作成例 ===

import { BaseCommand } from '../history/command'
import { Document } from './document'

/**
 * 複数レイヤーの透明度を一括変更するカスタムコマンド
 */
class BatchOpacityCommand extends BaseCommand {
  public readonly type = 'batchOpacity'
  private layerIds: string[]
  private newOpacity: number
  private previousOpacities: Map<string, number> = new Map()

  constructor(layerIds: string[], opacity: number) {
    super()
    this.layerIds = layerIds
    this.newOpacity = opacity
  }

  execute(document: Document): void {
    this.layerIds.forEach((layerId) => {
      const layer = document.layers.get(layerId)
      if (layer) {
        this.previousOpacities.set(layerId, layer.opacity)
        layer.opacity = this.newOpacity
      }
    })
    document.updatedAt = new Date()
  }

  undo(document: Document): void {
    this.layerIds.forEach((layerId) => {
      const layer = document.layers.get(layerId)
      const previousOpacity = this.previousOpacities.get(layerId)
      if (layer && previousOpacity !== undefined) {
        layer.opacity = previousOpacity
      }
    })
    document.updatedAt = new Date()
  }

  getDescription(): string {
    return `${this.layerIds.length}個のレイヤーの透明度を${this.newOpacity}に変更`
  }
}

// カスタムコマンドの使用例
export function customCommandExample(paplico: PaplicoEngine) {
  // 複数レイヤーの透明度を一括変更
  const batchCommand = new BatchOpacityCommand(
    ['layer1', 'layer2', 'layer3'],
    0.7,
  )
  paplico.executeCommand(batchCommand)
}
