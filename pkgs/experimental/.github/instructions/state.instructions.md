# States

# 実装計画
1. ベクターストローク描画の統合とリアルタイムプレビュー実装 [in-progress]
   StrokeRendererをコアエンジンに統合し、ユーザーがキャンバス上でベクターストロークを描画できるようにする。

2. console.logとdebugLoggerの削除 [todo]
   engine/以下からconsole.logとdebugLoggerの呼び出しを削除する（他のコードは除く）。

# 現在進行中のタスクの作業メモ

## 現在の問題と修正
- **描画中のストロークが表示されない問題を修正中**
- 原因: `endDrawing()`で`currentStroke`が即座にnullになり、レンダリングループで描画される前にクリアされる
- 修正: 描画終了時に1フレーム分（16ms）遅延させてから`currentStroke`をクリアするように変更

## 既に完了した修正
- StrokeRendererの初期化とPaplicoEngineへの統合
- 描画イベントハンドラー（handleDrawingStart/Move/End）の実装
- WebGPU-utilsのバッファ作成エラー（RangeError）の修正
- numComponentsの指定による属性配列の問題解決
- 詳細なデバッグログの追加とバッファ作成プロセスの診断
- レンダリングループのデバッグログ強化

## 完了した作業 - レイヤーパネルUI（階層構造DnD対応）
- LayerPanel.tsx: 完全なレイヤー階層構造対応のDnD実装
  - @dnd-kit/coreによるドラッグアンドドロップシステム
  - 入れ子レイヤー表示（グループ展開/折りたたみ）
  - 階層構造を維持したドラッグアンドドロップ
  - DropZoneコンポーネント（before/inside/after位置）
  - カスタム衝突検知（グループ内アイテム検知）
  - 視覚的なドラッグフィードバック（DragOverlay）
  - レイヤー/グループ追加機能
  - 透明度スライダー、表示/非表示切り替え
  - レイヤー削除機能（最後の1つは削除不可）
  - ドラッグ干渉問題の修正（UI操作とドラッグ操作の分離）
- engineState: レイヤー階層管理機能の追加
  - getLayerTree(): フラットなレイヤー配列を階層構造に変換
  - moveLayerToGroup(): レイヤーをグループ間で移動
  - addGroupLayer(): グループレイヤー追加
  - toggleGroupExpanded(): グループ展開/折りたたみ切り替え
  - LayerTreeItem型定義（depth、hasChildren、isExpanded）

## 完了した作業 - WebGPUレンダリング（階層構造対応）
- core-engine.ts: 階層構造レイヤーのレンダリング実装
  - renderLayerTree(): 階層構造のレイヤーツリーをレンダリング
  - renderLayerNodeRecursive(): レイヤーノードを再帰的にレンダリング
  - renderVectorLayer(): ベクターレイヤーのパス描画
  - グループ透明度の継承実装
  - 階層順序によるレンダリング順制御

## 現在の状態
- オフスクリーン合成システム: 完全実装済み、動作確認済み
- レイヤーパネルUI: 完全実装済み、階層構造DnD対応済み、ドラッグ干渉問題修正済み
- WebGPUレンダリング: 階層構造レイヤー対応済み（再帰的レンダリング、グループ透明度継承）
- デバッグログ: 改良済み（構造化されたログ出力）

## 完了した作業 - ドキュメント管理・ヒストリーシステム
- command.ts: ドキュメント操作用のコマンドシステム実装
  - ICommandインターフェース（execute/undo/canUndo/getDescription）
  - BaseCommandクラス（共通機能）
  - AddLayerCommand, RemoveLayerCommand, UpdateLayerCommand
  - AddArtObjectCommand, RemoveArtObjectCommand
- history.ts: Undo/Redoヒストリー管理システム
  - DocumentHistoryクラス（コマンド実行・undo・redo）
  - ヒストリーサイズ制限・イベント通知機能
  - エラーハンドリング・状態管理
- document-manager.ts: 複数ドキュメント同時管理システム
  - DocumentManagerクラス（複数ドキュメントの作成・切り替え・閉じる）
  - ドキュメントごとのキャッシュ管理（render/buffer/geometry/filter）
  - アクティブドキュメント管理・変更通知
- paplico.ts: 統合API実装
  - createDocument(), closeDocument(), setActiveDocument()
  - executeCommand(), undo(), redo(), getHistoryState()
  - getDocumentCache(), clearDocumentCache()
  - ヒストリー変更リスナー管理
- example-usage.ts: 使用例とカスタムコマンド作成方法

## 完了した作業 - CBORファイル保存システム
- serialization.ts: ドキュメントのCBORバイナリ変換システム
  - DocumentSerializerクラス（CBOR encode/decode）
  - FileIOHelperクラス（ブラウザファイル操作）
  - ProjectFileMetadata（メタデータ管理）
  - バージョン互換性チェック・ファイル形式管理
- paplico.ts: ファイルI/O API統合
  - saveDocumentToFile(), openDocumentFromFile()
  - loadDocumentFromFile(), serializeActiveDocument()
  - estimateDocumentFileSize(), deserializeDocument()
- Vitestテストスイート: 包括的なテストケース実装
  - DocumentSerializer, FileIOHelper, DocumentConverter
  - PaplicoEngine統合テスト（ドキュメント管理・ファイルI/O）

## 完了した作業 - VectorPath→PathArtObject変換システム
- state.ts: ユーザー入力からVectorObjectへの変換機能
  - convertVectorPathToArtObject(): VectorPathをPathArtObjectに変換
  - endDrawing(): 新しいドキュメント構造での描画終了処理
  - ストロークアピアランス自動生成（色・線幅・透明度）
- core-engine.ts: PathArtObjectレンダリング対応
  - renderPathArtObject(): PathArtObjectの専用レンダリング関数
  - appearanceベース描画（stroke/fill対応）
  - 新旧ドキュメント構造の両方に対応
- paplico.ts: 初期ドキュメント自動作成
  - initializeDefaultDocument(): エンジン起動時の初期ドキュメント作成
  - setDocument()統合によるengineState同期
- page.tsx: フロントエンド統合とテスト機能
  - テストストロークボタン追加
  - デバッグ情報の拡張（artObjectsCount表示）

## 現在の状態
- オフスクリーン合成システム: 完全実装済み、動作確認済み
- レイヤーパネルUI: 完全実装済み、階層構造DnD対応済み、ドラッグ干渉問題修正済み
- WebGPUレンダリング: 階層構造レイヤー対応済み（再帰的レンダリング、グループ透明度継承）
- ドキュメント管理・ヒストリー: 完全実装済み（複数ドキュメント、Undo/Redo、キャッシュ管理）
- CBORファイル保存システム: 完全実装済み（プロジェクトファイル形式、メタデータ管理）
- VectorPath→PathArtObject変換: 完全実装済み（ブラシ描画の新ドキュメント構造対応）
- デバッグログ: 改良済み（構造化されたログ出力）

## 完了したタスク: ブラシシステムへの筆圧・傾き・速度対応

### 実装完了内容
- [x] **Vector2インターフェース拡張**: pressure、tiltX、tiltY、velocity、timestampプロパティを追加
- [x] **BrushSettings拡張**: 筆圧・傾き・速度影響パラメータを追加（すべてオプション）
  - pressureSizeInfluence: 筆圧によるサイズへの影響度 (0.0-1.0)
  - pressureOpacityInfluence: 筆圧による不透明度への影響度 (0.0-1.0)
  - tiltInfluence: ペンの傾きによる形状への影響度 (0.0-1.0)
  - velocitySizeInfluence: 描画速度によるサイズへの影響度 (0.0-1.0)
  - velocityOpacityInfluence: 描画速度による不透明度への影響度 (0.0-1.0)
  - minSizeRatio: 最小サイズ制限 (0.0-1.0, ブラシサイズに対する割合)
  - minOpacity: 最小不透明度制限 (0.0-1.0)
- [x] **StrokeRenderer高度化**: 筆圧・傾き・速度を考慮したインスタンス生成を実装
  - interpolatePathPointData(): パスポイント間でpressure/tilt/velocityデータを線形補間
  - calculatePressureInfluence(): 筆圧による影響度計算
  - calculateTiltInfluence(): ペンの傾きによる形状変形計算
  - calculateVelocityInfluence(): 描画速度による影響計算
  - createStrokeInstances(): 各影響要素を統合した最終ブラシインスタンス生成
- [x] **InputManager高度化**: pressure/tilt/velocity取得とリアルタイム計算
  - EnhancedPointerEvent: 拡張されたポインターイベントインターフェース
  - PointerEvent.pressure/tiltX/tiltY自動抽出
  - タッチデバイスforce property対応
  - マウスクリック状態から筆圧シミュレーション
  - リアルタイム速度計算（前回位置との距離と時間差）
- [x] **後方互換性確保**: 既存コードとの互換性維持
  - 新しいBrushSettingsプロパティをすべてオプション化
  - デフォルト値による安全なフォールバック
  - 既存のランダムスキャッター機能との共存
  - シード値による決定的レンダリングとの互換性

### 実装の技術的特徴
- **デバイス対応**: ペンタブレット、タッチデバイス、マウス
- **クロスプラットフォーム**: 異なるブラウザでのPointerEvent API対応
- **スムーズな補間**: パスポイント間の自然な変化
- **パフォーマンス最適化**: 必要な時のみ計算実行
- **決定的レンダリング**: シード値との互換性維持

### ブラシシステムの現在の機能
1. **基本ブラシ機能**: texture、size、opacity、color
2. **高度なスキャッター**: scatter range、random rotation/scale
3. **In/Out効果**: ストローク開始/終了時のフェード
4. **シード値による決定的レンダリング**: 同じストロークは常に同じ見た目
5. **筆圧感知**: サイズと不透明度への影響
6. **ペン傾き対応**: 楕円形ブラシ変形
7. **速度感知**: 高速描画時の自然な変化
8. **リアルタイム速度計算**: ユーザーの描画速度を自動検知

## 現在の問題: ブラシ描画が表示されない状況

### 問題の概要
筆圧・傾き・速度対応の実装後、ブラシ描画が画面に表示されなくなっている。

### 特定された原因
1. **InputManager拡張による型不整合**
   - EnhancedPointerEventの導入でPointerEventとの互換性が失われた
   - paplico.tsの描画ハンドラーでevent.button、event.clientXなどのプロパティアクセスエラー

2. **既存コードとの統合問題**
   - 既存のコードがPointerEventの直接プロパティを期待している
   - EnhancedPointerEventのoriginalEventプロパティを経由する必要がある

### 実施した修正
- [x] **paplico.ts描画ハンドラーの更新**
  - handleDrawingStart/Move/End関数の型をEnhancedPointerEventに変更
  - event.originalEvent.buttonへのアクセス修正
  - event.x, event.yを直接使用（InputManagerでキャンバス相対座標計算済み）
  - pressure、tiltX、tiltY、velocity、timestampデータをVector2に含めて保存

- [x] **EnhancedPointerEventデータ活用**
  - 描画開始・移動・終了でpressure/tilt/velocityデータをログ出力
  - Vector2にpressure/tilt/velocity/timestampを含めてaddPointToCurrentStrokeに渡す
  - StrokeRendererで補間・影響度計算が適用される

### 残存する可能性のある問題
1. **TypeScript型エラー**: 他のファイルでまだEnhancedPointerEvent対応が不完全
2. **レンダリングパイプライン**: StrokeRendererの新機能がWebGPUパイプラインで正常動作していない可能性
3. **互換性問題**: 既存のVectorPathとの互換性でid/strokeWidthプロパティが不足

### 次のステップ
1. TypeScript型エラーの完全解決
2. 実際の描画テスト実行
3. デバッグログによる描画パイプライン確認
4. 必要に応じてWebGPUレンダリング部分のデバッグ

## 次のステップ（ブラシシステム完了後）
- StrokeRendererのメインキャンバス用/オフスクリーン用パイプライン多重化実装
- グループオブジェクトのオフスクリーン合成対応（階層的な合成）
- UIでのドキュメントタブ機能実装
- パフォーマンス最適化
