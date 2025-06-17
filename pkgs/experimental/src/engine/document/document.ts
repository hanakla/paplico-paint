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
  /** レイヤーの配列（IDをキーとするオブジェクト） */
  layers: Record<UUID, Layer>
  /** レイヤー階層構造 */
  layerNodes: LayerNode[]
  /** ArtObjectの配列（IDをキーとするオブジェクト） */
  artObjects: Record<UUID, ArtObject>
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
    layers: {},
    layerNodes: [],
    artObjects: {},
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
  document.layers[layer.id] = layer

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
  const layer = document.layers[layerId]
  if (!layer) return false

  // レイヤーに属するArtObjectも削除
  if (layer.type === 'vector') {
    layer.artObjectIds.forEach((artObjectId) => {
      delete document.artObjects[artObjectId]
    })
  }

  // 子レイヤーも削除（グループレイヤーの場合）
  if (layer.type === 'group') {
    layer.childLayerIds.forEach((childId) => {
      removeLayerFromDocument(document, childId)
    })
  }

  // レイヤーとレイヤーノードを削除
  delete document.layers[layerId]
  const nodeIndex = document.layerNodes.findIndex(
    (node) => node.layerId === layerId,
  )
  if (nodeIndex !== -1) {
    document.layerNodes.splice(nodeIndex, 1)
  }

  document.updatedAt = new Date()

  // アクティブなレイヤーが削除された場合の処理
  if (document.activeLayerId === layerId) {
    const remainingLayers = Object.keys(document.layers)
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
  document.artObjects[artObject.id] = artObject

  // 所属レイヤーのartObjectIdsにも追加
  const layer = document.layers[artObject.layerId]
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
  const artObject = document.artObjects[artObjectId]
  if (!artObject) return false

  // 所属レイヤーのartObjectIdsからも削除
  const layer = document.layers[artObject.layerId]
  if (layer && layer.type === 'vector') {
    const index = layer.artObjectIds.indexOf(artObjectId)
    if (index !== -1) {
      layer.artObjectIds.splice(index, 1)
    }
  }

  delete document.artObjects[artObjectId]

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
  return document.layers[layerId]
}

/**
 * ArtObjectをIDで取得
 */
export function getArtObjectById(
  document: Document,
  artObjectId: UUID,
): ArtObject | undefined {
  return document.artObjects[artObjectId]
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
    .map((node) => document.layers[node.layerId]!)
    .filter(Boolean)
}

/**
 * 指定したアートボード上のArtObjectを取得
 */
export function getArtObjectsOnArtboard(
  document: Document,
  artboardId: UUID | null,
): ArtObject[] {
  return Object.values(document.artObjects).filter(
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
  return Object.values(document.artObjects).filter(
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
    .map((id) => document.artObjects[id]!)
    .filter(Boolean)
}

/**
 * レイヤーの表示/非表示を切り替え
 */
export function toggleLayerVisibility(document: Document, layerId: UUID): void {
  const layer = document.layers[layerId]
  if (layer) {
    layer.visible = !layer.visible
    document.updatedAt = new Date()
  }
}

/**
 * レイヤーの不透明度を設定
 */
export function setLayerOpacity(
  document: Document,
  layerId: UUID,
  opacity: number,
): void {
  const layer = document.layers[layerId]
  if (layer) {
    layer.opacity = Math.max(0, Math.min(1, opacity))
    document.updatedAt = new Date()
  }
}

/**
 * アクティブレイヤーを設定
 */
export function setActiveLayer(document: Document, layerId: UUID): void {
  if (document.layers[layerId]) {
    document.activeLayerId = layerId
    document.updatedAt = new Date()
  }
}

/**
 * グループレイヤーの展開状態を切り替え
 */
export function toggleGroupExpanded(document: Document, layerId: UUID): void {
  const layer = document.layers[layerId]
  if (layer && layer.type === 'group') {
    layer.expanded = !layer.expanded
    document.updatedAt = new Date()
  }
}

/**
 * ベクターレイヤーのartObjects展開状態を切り替え
 */
export function toggleLayerArtObjectsExpanded(
  document: Document,
  layerId: UUID,
): void {
  const layer = document.layers[layerId]
  if (layer) {
    ;(layer as any).artObjectsExpanded = !(layer as any).artObjectsExpanded
    document.updatedAt = new Date()
  }
}

/**
 * レイヤーをグループに移動
 */
export function moveLayerToGroup(
  document: Document,
  layerId: UUID,
  targetGroupId: UUID | null,
): void {
  const node = document.layerNodes.find((n) => n.layerId === layerId)
  if (node) {
    node.parentId = targetGroupId

    const maxOrder = document.layerNodes
      .filter((n) => n.parentId === targetGroupId)
      .reduce((max, n) => Math.max(max, n.order), -1)

    node.order = maxOrder + 1
    document.updatedAt = new Date()
  }
}

/**
 * ArtObjectを別のレイヤーに移動
 */
export function moveArtObjectToLayer(
  document: Document,
  artObjectId: UUID,
  targetLayerId: UUID,
): void {
  const artObject = document.artObjects[artObjectId]
  if (artObject) {
    const oldLayerId = artObject.layerId
    const oldLayer = document.layers[oldLayerId]
    const newLayer = document.layers[targetLayerId]

    if (
      oldLayer &&
      newLayer &&
      oldLayer.type === 'vector' &&
      newLayer.type === 'vector'
    ) {
      // 古いレイヤーからartObjectIdを削除
      const oldIndex = oldLayer.artObjectIds.indexOf(artObjectId)
      if (oldIndex !== -1) {
        oldLayer.artObjectIds.splice(oldIndex, 1)
      }

      // 新しいレイヤーにartObjectIdを追加
      newLayer.artObjectIds.push(artObjectId)

      // artObjectのlayerIdを更新
      artObject.layerId = targetLayerId
      document.updatedAt = new Date()
    }
  }
}

/**
 * レイヤーの順序を変更
 */
export function reorderLayers(document: Document, layerIds: UUID[]): void {
  layerIds.forEach((layerId, index) => {
    const node = document.layerNodes.find((n) => n.layerId === layerId)
    if (node) {
      node.order = index
    }
  })
  document.updatedAt = new Date()
}

/**
 * 拡張ツリーアイテム：レイヤーとartObjectsの統合表示用
 */
export interface ExtendedTreeItem {
  type: 'layer' | 'artObject'
  id: string
  name: string
  depth: number
  visible: boolean
  locked?: boolean
  hasChildren: boolean
  isExpanded: boolean
  // artObject情報（type === 'artObject'の場合）
  parentLayerId?: string
  // レイヤー情報（type === 'layer'の場合）
  layer?: Layer
}

/**
 * ドキュメント用の拡張ツリー（レイヤー + artObjects）
 */
export function getExtendedTree(document: Document): ExtendedTreeItem[] {
  const result: ExtendedTreeItem[] = []

  const addChildrenToExtendedTree = (
    parentId: string | null,
    depth: number,
  ) => {
    const childNodes = document.layerNodes
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => a.order - b.order)

    childNodes.forEach((node) => {
      const layer = document.layers[node.layerId]
      if (layer) {
        // レイヤーノードを追加
        const hasChildren =
          document.layerNodes.some((n) => n.parentId === layer.id) ||
          (layer.type === 'vector' && layer.artObjectIds.length > 0)
        const isExpanded =
          layer.type === 'group'
            ? layer.expanded !== false
            : layer.type === 'vector'
            ? (layer as any).artObjectsExpanded !== false
            : false

        result.push({
          type: 'layer',
          id: layer.id,
          name: layer.name,
          depth,
          visible: layer.visible !== false,
          locked: layer.locked || false,
          hasChildren,
          isExpanded,
          layer,
        })

        // グループレイヤーの場合、子レイヤーを追加
        if (layer.type === 'group' && isExpanded) {
          addChildrenToExtendedTree(layer.id, depth + 1)
        }

        // ベクターレイヤーの場合、artObjectsを追加
        if (
          layer.type === 'vector' &&
          isExpanded &&
          layer.artObjectIds.length > 0
        ) {
          layer.artObjectIds.forEach((artObjectId) => {
            const artObject = document.artObjects[artObjectId]
            if (artObject) {
              result.push({
                type: 'artObject',
                id: artObject.id,
                name: artObject.name,
                depth: depth + 1,
                visible: artObject.visible !== false,
                locked: artObject.locked || false,
                hasChildren: false,
                isExpanded: false,
                parentLayerId: layer.id,
              })
            }
          })
        }
      }
    })
  }

  addChildrenToExtendedTree(null, 0)
  return result
}
