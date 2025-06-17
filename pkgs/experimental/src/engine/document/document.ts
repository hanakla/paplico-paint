import { UUID } from './types'
import { Artboard, CreateArtboardParams, createArtboard } from './artboard'
import { Layer, LayerNode, createLayerNode } from './layer'
import { ArtObject } from './art-object'

/**
 * ドキュメント：全体の描画コンテンツを管理
 */
export interface Document {
  id: UUID
  name: string
  /** ドキュメントの作成日時 */
  createdAt: Date
  /** ドキュメントの最終更新日時 */
  updatedAt: Date
  /** アートボードの配列 */
  artboards: Artboard[]
  /** レイヤーの配列（IDをキーとするマップ） */
  layers: Map<UUID, Layer>
  /** レイヤー階層構造 */
  layerNodes: LayerNode[]
  /** ArtObjectの配列（IDをキーとするマップ） */
  artObjects: Map<UUID, ArtObject>
  /** アクティブなアートボードのID */
  activeArtboardId?: UUID | null
  /** アクティブなレイヤーのID */
  activeLayerId?: UUID | null
  /** 選択されたArtObjectのID配列 */
  selectedArtObjectIds: UUID[]
}

/**
 * ドキュメント作成用パラメータ
 */
export interface CreateDocumentParams {
  name?: string
  /** 初期アートボードの設定 */
  initialArtboard?: CreateArtboardParams
}

/**
 * ドキュメント作成ファクトリー関数
 */
export function createDocument(params: CreateDocumentParams = {}): Document {
  const now = new Date()
  const document: Document = {
    id: crypto.randomUUID(),
    name: params.name || 'Untitled Document',
    createdAt: now,
    updatedAt: now,
    artboards: [],
    layers: new Map(),
    layerNodes: [],
    artObjects: new Map(),
    selectedArtObjectIds: [],
  }

  // 初期アートボードを作成
  if (params.initialArtboard) {
    const artboard = createArtboard(params.initialArtboard)
    document.artboards.push(artboard)
    document.activeArtboardId = artboard.id
  }

  return document
}

/**
 * ドキュメントにアートボードを追加
 */
export function addArtboardToDocument(
  document: Document,
  params: CreateArtboardParams,
): Artboard {
  const artboard = createArtboard(params)
  document.artboards.push(artboard)
  document.updatedAt = new Date()

  // 最初のアートボードの場合はアクティブに設定
  if (!document.activeArtboardId) {
    document.activeArtboardId = artboard.id
  }

  return artboard
}

/**
 * ドキュメントからアートボードを削除
 */
export function removeArtboardFromDocument(
  document: Document,
  artboardId: UUID,
): boolean {
  const index = document.artboards.findIndex((ab) => ab.id === artboardId)
  if (index === -1) return false

  document.artboards.splice(index, 1)
  document.updatedAt = new Date()

  // アクティブなアートボードが削除された場合の処理
  if (document.activeArtboardId === artboardId) {
    document.activeArtboardId =
      document.artboards.length > 0 ? document.artboards[0].id : null
  }

  return true
}

/**
 * ドキュメントにレイヤーを追加
 */
export function addLayerToDocument(
  document: Document,
  layer: Layer,
  parentId: UUID | null = null,
): void {
  document.layers.set(layer.id, layer)

  // レイヤーノードを作成してツリーに追加
  const order = document.layerNodes.filter(
    (node) => node.parentId === parentId,
  ).length
  const layerNode = createLayerNode(layer.id, parentId, order)
  document.layerNodes.push(layerNode)

  document.updatedAt = new Date()

  // 最初のレイヤーの場合はアクティブに設定
  if (!document.activeLayerId) {
    document.activeLayerId = layer.id
  }
}

/**
 * ドキュメントからレイヤーを削除
 */
export function removeLayerFromDocument(
  document: Document,
  layerId: UUID,
): boolean {
  const layer = document.layers.get(layerId)
  if (!layer) return false

  // レイヤーに属するArtObjectも削除
  if (layer.type === 'vector') {
    layer.artObjectIds.forEach((artObjectId) => {
      document.artObjects.delete(artObjectId)
    })
  }

  // 子レイヤーも削除（グループレイヤーの場合）
  if (layer.type === 'group') {
    layer.childLayerIds.forEach((childId) => {
      removeLayerFromDocument(document, childId)
    })
  }

  // レイヤーとレイヤーノードを削除
  document.layers.delete(layerId)
  const nodeIndex = document.layerNodes.findIndex(
    (node) => node.layerId === layerId,
  )
  if (nodeIndex !== -1) {
    document.layerNodes.splice(nodeIndex, 1)
  }

  document.updatedAt = new Date()

  // アクティブなレイヤーが削除された場合の処理
  if (document.activeLayerId === layerId) {
    const remainingLayers = Array.from(document.layers.keys())
    document.activeLayerId =
      remainingLayers.length > 0 ? remainingLayers[0] : null
  }

  return true
}

/**
 * ドキュメントにArtObjectを追加
 */
export function addArtObjectToDocument(
  document: Document,
  artObject: ArtObject,
): void {
  document.artObjects.set(artObject.id, artObject)

  // 所属レイヤーのartObjectIdsにも追加
  const layer = document.layers.get(artObject.layerId)
  if (layer && layer.type === 'vector') {
    layer.artObjectIds.push(artObject.id)
  }

  document.updatedAt = new Date()
}

/**
 * ドキュメントからArtObjectを削除
 */
export function removeArtObjectFromDocument(
  document: Document,
  artObjectId: UUID,
): boolean {
  const artObject = document.artObjects.get(artObjectId)
  if (!artObject) return false

  // 所属レイヤーのartObjectIdsからも削除
  const layer = document.layers.get(artObject.layerId)
  if (layer && layer.type === 'vector') {
    const index = layer.artObjectIds.indexOf(artObjectId)
    if (index !== -1) {
      layer.artObjectIds.splice(index, 1)
    }
  }

  document.artObjects.delete(artObjectId)

  // 選択状態からも削除
  const selectedIndex = document.selectedArtObjectIds.indexOf(artObjectId)
  if (selectedIndex !== -1) {
    document.selectedArtObjectIds.splice(selectedIndex, 1)
  }

  document.updatedAt = new Date()
  return true
}

/**
 * アートボードをIDで取得
 */
export function getArtboardById(
  document: Document,
  artboardId: UUID,
): Artboard | undefined {
  return document.artboards.find((ab) => ab.id === artboardId)
}

/**
 * レイヤーをIDで取得
 */
export function getLayerById(
  document: Document,
  layerId: UUID,
): Layer | undefined {
  return document.layers.get(layerId)
}

/**
 * ArtObjectをIDで取得
 */
export function getArtObjectById(
  document: Document,
  artObjectId: UUID,
): ArtObject | undefined {
  return document.artObjects.get(artObjectId)
}

/**
 * 指定したレイヤーの子レイヤーを取得
 */
export function getChildLayers(
  document: Document,
  parentId: UUID | null,
): Layer[] {
  const childNodes = document.layerNodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.order - b.order)

  return childNodes
    .map((node) => document.layers.get(node.layerId)!)
    .filter(Boolean)
}

/**
 * 指定したアートボード上のArtObjectを取得
 */
export function getArtObjectsOnArtboard(
  document: Document,
  artboardId: UUID | null,
): ArtObject[] {
  return Array.from(document.artObjects.values()).filter(
    (artObject) =>
      artObject.artboardId === artboardId || artObject.artboardId === null,
  )
}

/**
 * 指定したレイヤーに属するArtObjectを取得
 */
export function getArtObjectsInLayer(
  document: Document,
  layerId: UUID,
): ArtObject[] {
  return Array.from(document.artObjects.values()).filter(
    (artObject) => artObject.layerId === layerId,
  )
}

/**
 * アクティブなアートボードを取得
 */
export function getActiveArtboard(document: Document): Artboard | undefined {
  return document.activeArtboardId
    ? getArtboardById(document, document.activeArtboardId)
    : undefined
}

/**
 * アクティブなレイヤーを取得
 */
export function getActiveLayer(document: Document): Layer | undefined {
  return document.activeLayerId
    ? getLayerById(document, document.activeLayerId)
    : undefined
}

/**
 * 選択されたArtObjectを取得
 */
export function getSelectedArtObjects(document: Document): ArtObject[] {
  return document.selectedArtObjectIds
    .map((id) => document.artObjects.get(id)!)
    .filter(Boolean)
}
