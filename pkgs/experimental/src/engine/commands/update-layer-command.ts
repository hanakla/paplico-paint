import type { Document } from '../document/document'
import type { UUID } from '../document/types'
import { BaseCommand } from './base'

/**
 * レイヤー属性更新コマンド
 */
export interface UpdateLayerCommandParams {
  layerId: UUID
  changes: Partial<any>
}

export class UpdateLayerCommand extends BaseCommand {
  public readonly type = 'updateLayer'
  private params: UpdateLayerCommandParams
  private previousValues: Partial<any> = {}

  constructor(params: UpdateLayerCommandParams) {
    super()
    this.params = params
  }

  execute(document: Document): void {
    const layer = document.layers[this.params.layerId]
    if (!layer) return

    // 前の値を保存
    for (const key in this.params.changes) {
      this.previousValues[key] = (layer as any)[key]
    }

    // 変更を適用
    Object.assign(layer, this.params.changes)
    document.updatedAt = new Date()
  }

  undo(document: Document): void {
    const layer = document.layers[this.params.layerId]
    if (!layer) return

    // 前の値を復元
    Object.assign(layer, this.previousValues)
    document.updatedAt = new Date()
  }

  getDescription(): string {
    const changeKeys = Object.keys(this.params.changes)
    return `レイヤー更新: ${changeKeys.join(', ')}`
  }
}
