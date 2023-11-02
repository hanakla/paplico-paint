import { tx } from './lib/i18n'

export const common = tx({
  en: {},
  ja: {},
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
