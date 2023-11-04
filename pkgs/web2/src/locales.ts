import { tx } from './lib/i18n'

export const common = tx({
  en: {},
  ja: {},
})

export const notificationTexts = tx({
  en: {
    toolChanged: '{{tool}} tool',
    'tools.none': 'LOL',
    'tools.cursor': 'Cursor',
    'tools.stroking': 'Brush',
    'tools.erasing': 'Eraser',

    'tools.objectTool': 'Object',
    'tools.pointTool': 'Point',
    'tools.vectorPen': 'Vector pen',
    'tools.rectangleTool': 'Shape (Rectangle)',
    'tools.ellipseTool': 'Shape (Ellipse)',

    'history.undo': 'Undo',
    'history.redo': 'Redo',
  },
  ja: {
    toolChanged: '{{tool}} ツール',
    'tools.none': 'ウケる',
    'tools.cursor': '移動',
    'tools.stroking': 'ブラシ',
    'tools.erasing': '消しゴム',

    'tools.objectTool': 'オブジェクト編集',
    'tools.pointTool': 'ポイント編集',
    'tools.vectorPen': '曲線',
    'tools.rectangleTool': '図形(四角形)',
    'tools.ellipseTool': '図形(円)',

    'history.undo': 'もとに戻す',
    'history.redo': 'やりなおす',
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

export const filtersPane = tx({
  en: {
    title: 'Filters',
  },
  ja: {
    title: 'フィルター',
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
  },
  ja: {
    'tabs.normalLayer': '通常',
    'tabs.vectorLayer': 'ベクター',
    'tools.brush': 'ブラシ',
    'tools.eraser': '消しゴム',
    vectorToolOnlyOnVectorLayer:
      'ベクターレイヤー上でのみベクターツールを使用できます',
    'tools.shapeRect': '図形(四角形)',
    'tools.shapeEllipse': '図形(円)',
  },
})
