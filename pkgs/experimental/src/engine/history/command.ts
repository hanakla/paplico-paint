import { Document } from '../document/document'
import { UUID } from '../document/types'

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
    this.id = crypto.randomUUID()
    this.timestamp = new Date()
  }

  abstract execute(document: Document): void
  abstract undo(document: Document): void
  abstract getDescription(): string

  canUndo(): boolean {
    return true
  }
}

/**
 * レイヤー追加コマンド
 */
export interface AddLayerCommandParams {
  layerId: UUID
  layerData: any
  parentId?: UUID | null
  order?: number
}

export class AddLayerCommand extends BaseCommand {
  public readonly type = 'addLayer'
  private params: AddLayerCommandParams

  constructor(params: AddLayerCommandParams) {
    super()
    this.params = params
  }

  execute(document: Document): void {
    const { layerData, parentId } = this.params
    document.layers.set(this.params.layerId, layerData)

    const order =
      this.params.order ??
      document.layerNodes.filter((node) => node.parentId === parentId).length

    document.layerNodes.push({
      layerId: this.params.layerId,
      parentId: parentId || null,
      order,
    })

    document.updatedAt = new Date()
  }

  undo(document: Document): void {
    document.layers.delete(this.params.layerId)
    const nodeIndex = document.layerNodes.findIndex(
      (node) => node.layerId === this.params.layerId,
    )
    if (nodeIndex !== -1) {
      document.layerNodes.splice(nodeIndex, 1)
    }
    document.updatedAt = new Date()
  }

  getDescription(): string {
    return `レイヤー追加: ${this.params.layerData.name}`
  }
}

/**
 * レイヤー削除コマンド
 */
export interface RemoveLayerCommandParams {
  layerId: UUID
}

export class RemoveLayerCommand extends BaseCommand {
  public readonly type = 'removeLayer'
  private params: RemoveLayerCommandParams
  private savedLayerData: any = null
  private savedNodeData: any = null

  constructor(params: RemoveLayerCommandParams) {
    super()
    this.params = params
  }

  execute(document: Document): void {
    // データを保存してから削除
    this.savedLayerData = document.layers.get(this.params.layerId)
    this.savedNodeData = document.layerNodes.find(
      (node) => node.layerId === this.params.layerId,
    )

    document.layers.delete(this.params.layerId)
    const nodeIndex = document.layerNodes.findIndex(
      (node) => node.layerId === this.params.layerId,
    )
    if (nodeIndex !== -1) {
      document.layerNodes.splice(nodeIndex, 1)
    }
    document.updatedAt = new Date()
  }

  undo(document: Document): void {
    if (this.savedLayerData && this.savedNodeData) {
      document.layers.set(this.params.layerId, this.savedLayerData)
      document.layerNodes.push(this.savedNodeData)
      document.updatedAt = new Date()
    }
  }

  getDescription(): string {
    return `レイヤー削除: ${this.savedLayerData?.name || this.params.layerId}`
  }
}

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
    const layer = document.layers.get(this.params.layerId)
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
    const layer = document.layers.get(this.params.layerId)
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

/**
 * ArtObject追加コマンド
 */
export interface AddArtObjectCommandParams {
  artObjectId: UUID
  artObjectData: any
}

export class AddArtObjectCommand extends BaseCommand {
  public readonly type = 'addArtObject'
  private params: AddArtObjectCommandParams

  constructor(params: AddArtObjectCommandParams) {
    super()
    this.params = params
  }

  execute(document: Document): void {
    document.artObjects.set(this.params.artObjectId, this.params.artObjectData)

    // 所属レイヤーのartObjectIdsに追加
    const layer = document.layers.get(this.params.artObjectData.layerId)
    if (layer && layer.type === 'vector') {
      layer.artObjectIds.push(this.params.artObjectId)
    }

    document.updatedAt = new Date()
  }

  undo(document: Document): void {
    document.artObjects.delete(this.params.artObjectId)

    // 所属レイヤーのartObjectIdsからも削除
    const layer = document.layers.get(this.params.artObjectData.layerId)
    if (layer && layer.type === 'vector') {
      const index = layer.artObjectIds.indexOf(this.params.artObjectId)
      if (index !== -1) {
        layer.artObjectIds.splice(index, 1)
      }
    }

    document.updatedAt = new Date()
  }

  getDescription(): string {
    return `オブジェクト追加: ${this.params.artObjectData.type}`
  }
}

/**
 * ArtObject削除コマンド
 */
export interface RemoveArtObjectCommandParams {
  artObjectId: UUID
}

export class RemoveArtObjectCommand extends BaseCommand {
  public readonly type = 'removeArtObject'
  private params: RemoveArtObjectCommandParams
  private savedArtObjectData: any = null

  constructor(params: RemoveArtObjectCommandParams) {
    super()
    this.params = params
  }

  execute(document: Document): void {
    this.savedArtObjectData = document.artObjects.get(this.params.artObjectId)
    if (!this.savedArtObjectData) return

    document.artObjects.delete(this.params.artObjectId)

    // 所属レイヤーのartObjectIdsからも削除
    const layer = document.layers.get(this.savedArtObjectData.layerId)
    if (layer && layer.type === 'vector') {
      const index = layer.artObjectIds.indexOf(this.params.artObjectId)
      if (index !== -1) {
        layer.artObjectIds.splice(index, 1)
      }
    }

    document.updatedAt = new Date()
  }

  undo(document: Document): void {
    if (this.savedArtObjectData) {
      document.artObjects.set(this.params.artObjectId, this.savedArtObjectData)

      // 所属レイヤーのartObjectIdsにも追加
      const layer = document.layers.get(this.savedArtObjectData.layerId)
      if (layer && layer.type === 'vector') {
        layer.artObjectIds.push(this.params.artObjectId)
      }

      document.updatedAt = new Date()
    }
  }

  getDescription(): string {
    return `オブジェクト削除: ${
      this.savedArtObjectData?.type || this.params.artObjectId
    }`
  }
}
