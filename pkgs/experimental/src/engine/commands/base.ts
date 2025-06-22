import type { Document } from '../document/document'
import type { UUID } from '../document/types'
import { generateUid } from '../document/utils'

/**
 * ドキュメント操作コマンドのベースインターフェース
 */
export interface ICommand {
  /** コマンドの一意識別子 */
  id: UUID
  /** コマンドの種類 */
  type: string
  /** コマンドの実行時刻 */
  timestamp: Date
  /** コマンドを実行 */
  execute(document: Document): void
  /** コマンドを取り消し */
  undo(document: Document): void
  /** コマンドが取り消し可能かどうか */
  canUndo(): boolean
  /** コマンドの説明 */
  getDescription(): string
}

/**
 * コマンドの基底クラス
 */
export abstract class BaseCommand implements ICommand {
  public readonly id: UUID
  public readonly timestamp: Date
  public abstract readonly type: string

  constructor() {
    this.id = generateUid()
    this.timestamp = new Date()
  }

  abstract execute(document: Document): void
  abstract undo(document: Document): void
  abstract getDescription(): string

  canUndo(): boolean {
    return true
  }
}
