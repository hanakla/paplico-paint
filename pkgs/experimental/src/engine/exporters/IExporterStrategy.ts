import type { DocumentContext } from '../document-manager'
import type { PaplicoEngine } from '../paplico'

/**
 * エクスポーター戦略インターフェース
 *
 * 異なるフォーマットや範囲でのエクスポート機能を統一的に扱うための
 * Strategy パターンのインターフェース
 */
export interface IExporterStrategy {
  /**
   * エクスポートを実行
   *
   * @param documentContext - エクスポート対象のドキュメントコンテキスト
   * @param paplicoEngine - レンダリング用のPaplicoエンジン
   * @returns エクスポートされたデータのFile配列
   */
  export(
    documentContext: DocumentContext,
    paplicoEngine: PaplicoEngine,
  ): Promise<File[]>
}
