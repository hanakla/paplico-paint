type UUID = string;

/**
 * ドキュメント：全体の描画コンテンツを管理
 */
export interface Document {
  id: UUID;
  name: string;
  /** ドキュメントの作成日時 */
  createdAt: Date;
  /** ドキュメントの最終更新日時 */
  updatedAt: Date;
  /** アートボードの配列 */
  artboards: Artboard[];
  /** レイヤーの配列（IDをキーとするオブジェクト） */
  layers: Record<UUID, La
  yer>;
  /** レイヤー階層構造 */
  layerNodes: LayerNode[];
  /** ArtObjectの配列（IDをキーとするオブジェクト） */
  artObjects: Record<UUID, ArtObject>;
  /** アクティブなアートボードのID */
  activeArtboardId?: UUID | null;
  /** アクティブなレイヤーのID */
  activeLayerId?: UUID | null;
  /** 選択されたArtObjectのID配列 */
  selectedArtObjectIds: UUID[];
}


/**
 * アートボード：描画領域の定義
 * キャンバス上の特定の矩形領域を表す
 */
export interface Artboard {
  id: UUID;
  name: string;
  /** アートボードのキャンバス上での位置とサイズ */
  bounds: Bounds;
  /** 背景色（透明な場合はnull） */
  backgroundColor?: RGBAColor | null;
  /** 表示・非表示 */
  visible: boolean;
  /** ロック状態 */
  locked: boolean;
}
