# Project Instructions - Paplico Experimental Package

## 最新の実装状況

### アートボードPNGエクスポート機能 (2025年6月19日実装)

#### 実装概要
- アートボードを選択してPNG形式で個別書き出しする機能を完全実装
- Strategy パターンによる拡張可能なエクスポートシステム
- shadcn/ui ベースの直感的なUI
- 効率的な部分レンダリングによる高速書き出し

#### 主要コンポーネント

**1. エクスポート戦略システム**
- `IExporterStrategy` - 統一的なエクスポートインターフェース
- `PngAllArtboardExporter` - アートボード選択可能なPNG書き出し実装
- Strategy パターンにより将来的なフォーマット拡張が容易

**2. エクスポートダイアログ (`src/dialogs/ExportDialog.tsx`)**
- shadcn/ui の Dialog コンポーネントベース
- アートボード選択UI（チェックボックス）
- プレビュー機能付きのサムネイル表示
- 1:1 正方形サムネイル、コンパクトなデザイン
- 全選択/選択解除機能

**3. UI統合**
- メインツールバーにエクスポートボタン統合（Undo/Redoの隣）
- 横スクロール対応のツールバー
- user-select-none 対応でボタンテキスト選択防止

**4. 効率的レンダリングシステム**
- `renderRegionToTexture()` - オフスクリーンテクスチャレンダリング
- `renderRegionToImageData()` - ImageData直接取得
- `readTextureAsImageData()` - GPU→CPU データ転送
- 部分レンダリングによる高速化

#### 技術的特徴

**レンダリング最適化**
- 各アートボードを個別にオフスクリーンレンダリング
- GPUテクスチャから効率的にImageData変換
- HTMLCanvasElement使用でブラウザ互換性確保
- カメラ状態の一時変更と復元

**型システム**
- `PngExportOptions` インターフェースで設定管理
- `IExporterStrategy` による統一API
- TypeScript strict モード対応

**エラーハンドリング**
- WebGPU デバイス可用性チェック
- テクスチャ作成失敗時の適切な処理
- アートボード境界検証
- リソースクリーンアップ保証

#### ファイル構成

```
src/
├── dialogs/
│   └── ExportDialog.tsx          # メインエクスポートUI
├── engine/
│   ├── exporters/
│   │   ├── IExporterStrategy.ts  # エクスポート戦略インターフェース
│   │   ├── PngAllArtboardExporter.ts # PNG書き出し実装
│   │   └── index.ts              # エクスポート関連型・クラス
│   ├── paplico.ts               # レンダリングAPIメソッド追加
│   └── webgpu/
│       └── core-engine.ts       # 部分レンダリング機能
└── components/ui/
    ├── button.tsx               # user-select-none 対応
    ├── checkbox.tsx             # shadcn/ui チェックボックス
    └── dialog.tsx               # shadcn/ui ダイアログ
```

#### 使用方法

```typescript
// 1. エクスポーター作成（アートボード選択）
const exporter = new PngAllArtboardExporter({
  selectedArtboardIds: ['artboard-1', 'artboard-2']
})

// 2. エクスポート実行
const files = await exporter.export(documentContext, paplicoEngine)

// 3. ファイルダウンロード
files.forEach(file => {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
})
```

#### 今後の拡張方針

**新フォーマット対応**
- SVG エクスポーター実装
- PDF エクスポーター実装
- WebP エクスポーター実装

**機能拡張**
- 書き出し品質設定（DPI調整）
- バッチ書き出し（複数フォーマット同時）
- 進捗表示機能
- カスタムファイル名テンプレート

**パフォーマンス最適化**
- Worker を使用した並列書き出し
- プリント対応の高解像度書き出し
- メモリ効率化（大サイズアートボード対応）

#### 関連技術
- **WebGPU**: オフスクリーンレンダリング
- **shadcn/ui**: モダンなUIコンポーネント
- **Strategy Pattern**: 拡張可能なアーキテクチャ
- **Tailwind CSS**: レスポンシブデザイン
- **TypeScript**: 型安全な実装

#### 注意事項
- WebGPU サポート必須（fallback なし）
- アートボード境界の正確性に依存
- メモリ使用量は書き出しサイズに比例
- OffscreenCanvas の代わりに HTMLCanvasElement 使用（互換性重視）

この実装により、Paplico Paint では直感的で高速なアートボード書き出し機能を提供し、ユーザーの作品共有・印刷ワークフローを大幅に改善している。