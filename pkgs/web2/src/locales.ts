import { tx } from './lib/i18n'

export const common = tx({
  en: {},
  ja: {},
})

export const notificationTexts = tx({
  en: {
    toolChanged: '{{tool}} tool',
    'tools.none': 'LOL',
    'tools.objectTool': 'Object',
    'tools.eraserTool': 'Eraser',
    'tools.strokingTool': 'Brush',
    'tools.pointTool': 'Point edit',
    'tools.vectorPenTool': 'Vector Pen',
    'tools.rectangleTool': 'Shape (Rectangle)',
    'tools.ellipseTool': 'Shape (Ellipse)',

    'history.undo': 'Undo',
    'history.redo': 'Redo',

    'save.saving': 'Saving...',
    'save.saved': 'Saved',
  },
  ja: {
    toolChanged: '{{tool}} ツール',
    'tools.none': 'ウケる',
    'tools.objectTool': 'オブジェクト',
    'tools.eraserTool': '消しゴム',
    'tools.strokingTool': 'ブラシ',
    'tools.pointTool': 'ポイント編集',
    'tools.vectorPenTool': 'ベクターペン',
    'tools.rectangleTool': '図形 (四角形)',
    'tools.ellipseTool': '図形 (楕円)',

    'history.undo': '元に戻す',
    'history.redo': 'やりなおす',

    'save.saving': '保存しています...',
    'save.saved': '保存しました',
  },
})

export const brushesSettingPaneTexts = tx({
  en: {
    title: 'Brushes',
    size: 'Size',
  },
  ja: {
    title: 'ブラシ',
    size: 'サイズ',
  },
})

export const layersPaneTexts = tx({
  en: {
    title: 'Layers',
    layerName: 'Layer name',
    compositeMode: 'Blend mode',
    'compositeMode.normal': 'Normal',
    'compositeMode.multiply': 'Multiply',
    'compositeMode.screen': 'Screen',
    'compositeMode.overlay': 'Overlay',
    opacity: 'Opacity',
    'types.raster': '通常レイヤー',
    'types.vector': 'ベクターレイヤー',
  },
  ja: {
    title: 'レイヤー',
    layerName: 'レイヤー名',
    compositeMode: '合成モード',
    'compositeMode.normal': '通常',
    'compositeMode.multiply': '乗算',
    'compositeMode.screen': 'スクリーン',
    'compositeMode.overlay': 'オーバーレイ',
    opacity: '不透明度',
    'types.raster': '通常レイヤー',
    'types.vector': 'ベクターレイヤー',
  },
})

export const filtersPaneTexts = tx({
  en: {
    title: 'Filters',
    loading: 'Loading',
    'filterType.fill': 'Fill',
    'filterType.stroke': 'Stroke',
    'filterType.missingPostProcess': 'Missing filter {{id}}',

    'stroke.width': 'Width',
  },
  ja: {
    title: 'フィルター',
    loading: '読み込み中',
    'filterType.fill': '塗り',
    'filterType.stroke': '線',
    'filterType.missingPostProcess': '不明なフィルター {{id}}',

    'stroke.width': '線幅',
  },
})

export const mainToolbarTexts = tx({
  en: {
    'tabs.normalLayer': 'Normal',
    'tabs.vectorLayer': 'Vector',
    'tools.brush': 'Brush',
    'tools.eraser': 'Eraser',
    vectorToolOnlyOnVectorLayer: 'Vector tool can be used only on vector layer',
    'tools.shapeRect': 'Rectangle',
    'tools.shapeEllipse': 'Ellipse',
    'tools.objectTool': 'オブジェクト編集',
    'tools.pointTool': 'ポイント編集',
    'tools.vectorPen': '曲線',
    'tools.rectangleTool': '図形(四角形)',
    'tools.ellipseTool': '図形(円)',
  },
  ja: {
    'tabs.normalLayer': '通常',
    'tabs.vectorLayer': 'ベクター',
    'tools.brush': 'ブラシ',
    'tools.eraser': '消しゴム',
    vectorToolOnlyOnVectorLayer:
      'ベクターレイヤー上でのみベクターツールを使用できます',
    'tools.shapeRect': '図形<br/>(四角形)',
    'tools.shapeEllipse': '図形<br/>(円)',
    'tools.objectTool': 'オブジェクト<br/>編集',
    'tools.pointTool': 'ポイント編集',
    'tools.vectorPen': '曲線',
    'tools.rectangleTool': '図形(四角形)',
    'tools.ellipseTool': '図形(円)',
  },
})
