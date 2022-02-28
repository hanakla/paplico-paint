import { rgba, invert, grayscale } from 'polished'

const baseColors = {
  black10: 'hsl(215, 8%, 45.3%)',
  black20: 'hsl(215, 8%, 39.6%)',
  black30: 'hsl(215, 8%, 33.7%)',
  black40: 'hsl(215, 8%, 20.9%)',
  black50: 'hsl(215, 8%, 15.2%)',
  black60: 'hsl(214.9, 6.5%, 5.4%)',
  blackFade10: 'hsla(215, 8%, 45.3%, 0.12)',
  blackFade20: 'hsla(215, 8%, 39.6%, 0.24)',
  blackFade30: 'hsla(215, 8%, 33.7%, 0.36)',
  blackFade40: 'hsla(215, 8%, 20.9%, 0.42)',
  blackFade50: 'hsla(215, 8%, 10.2%, 0.56)',
  white10: 'hsl(0, 0%, 80.4%)',
  white20: 'hsl(0, 0%, 86.3%)',
  white30: 'hsl(0, 0%, 90.2%)',
  white40: 'hsl(0, 0%, 94.5%)',
  white50: 'hsl(0, 0%, 96.1%)',
  white60: 'hsl(0, 0%, 99%)',
  whiteFade10: 'hsla(0, 0%, 80.4%, 0.12)',
  whiteFade20: 'hsla(0, 0%, 86.3%, 0.24)',
  whiteFade30: 'hsla(0, 0%, 90.2%, 0.36)',
  whiteFade40: 'hsla(0, 0%, 94.5%, 0.42)',
  whiteFade50: 'hsla(0, 0%, 96.1%, 0.56)',
  blueFade40: 'hsla(207.9, 91%, 61%, 0.42)',
  blueFade50: 'hsla(207.9, 91%, 61%, 0.56)',
  blue50: 'hsl(207.9, 91%, 61%)',
  red50: 'hsl(342.9, 82.8%, 63.3%)',
}

const lightColor: typeof baseColors = {
  black10: 'hsl(0, 0%, 80.4%)',
  black20: 'hsl(0, 0%, 86.3%)',
  black30: 'hsl(0, 0%, 90.2%)',
  black40: 'hsl(0, 0%, 94.5%)',
  black50: 'hsl(0, 0%, 96.1%)',
  black60: 'hsl(0, 0%, 99%)',
  blackFade10: 'hsla(0, 0%, 80.4%, 0.12)',
  blackFade20: 'hsla(0, 0%, 86.3%, 0.24)',
  blackFade30: 'hsla(0, 0%, 90.2%, 0.36)',
  blackFade40: 'hsla(0, 0%, 94.5%, 0.42)',
  blackFade50: 'hsla(0, 0%, 96.1%, 0.56)',
  white10: 'hsl(215, 8%, 45.3%)',
  white20: 'hsl(215, 8%, 39.6%)',
  white30: 'hsl(215, 8%, 33.7%)',
  white40: 'hsl(215, 8%, 20.9%)',
  white50: 'hsl(215, 8%, 10.2%)',
  white60: 'hsl(214.9, 6.5%, 5.4%)',
  whiteFade10: 'hsla(215, 8%, 45.3%, 0.12)',
  whiteFade20: 'hsla(215, 8%, 39.6%, 0.24)',
  whiteFade30: 'hsla(215, 8%, 33.7%, 0.36)',
  whiteFade40: 'hsla(215, 8%, 20.9%, 0.42)',
  whiteFade50: 'hsla(215, 8%, 10.2%, 0.56)',
  blueFade40: 'hsla(207.9, 91%, 61%, 0.42)',
  blueFade50: 'hsla(207.9, 91%, 61%, 0.56)',
  blue50: 'hsl(207.9, 91%, 61%)',
  red50: 'hsl(342.9, 82.8%, 63.3%)',
}

export const theme = {
  text: {
    default: baseColors.black50,
    white: baseColors.white40,
    sidebarWhite: '#cfcfcf',
    sidebarListActive: baseColors.white40, //Required
    inputActive: '#333',
    inputPlaceholder: '#a9a9a9',
    floatActive: '#67696e',
    mainActionsBlack: '#464b4e',
    contextMenuActive: '#fff',
  },
  surface: {
    default: baseColors.black40,
    canvas: baseColors.black60, // Required
    black: baseColors.black20,
    sidebarBlack: '#464b4e',
    sidebarList: '#363a3d',
    sidebarListActive: baseColors.whiteFade20, // Required
    brushViewWhite: '#ccc',
    brushViewActive: rgba('#999', 0.5),
    inputActive: '#eee',
    floatWhite: rgba('#f5f5f5', 0.9),
    floatActive: rgba('#85baf6', 0.9),
    contextMenu: '#4798f5',
    contextMenuActive: rgba('#4798f5', 0.9),
    popupMenu: rgba('#464b4e', 1),
  },
  border: {
    floatActiveLayer: '#336cff',
  },
  colors: baseColors,
  exactColors: baseColors,
}

export const lightTheme = {
  text: {
    default: baseColors.white50,
    white: baseColors.black20,
    sidebarWhite: grayscale(invert('#cfcfcf')),
    sidebarListActive: baseColors.black40, //Required
    inputActive: '#333',
    inputPlaceholder: grayscale(invert('#a9a9a9')),
    floatActive: '#ececec',
    mainActionsBlack: grayscale(invert('#464b4e')),
    contextMenuActive: grayscale(invert('#fff')),
  },
  surface: {
    default: baseColors.white40,
    canvas: baseColors.white20, // Required
    black: '#f4f4f4',
    sidebarBlack: '#fbfbfb',
    sidebarList: '#eee',
    sidebarListActive: lightColor.blueFade40, // Required
    brushViewWhite: grayscale(invert('#ccc')),
    brushViewActive: grayscale(invert(rgba('#999', 0.5))),
    inputActive: '#eee',
    floatWhite: rgba('#f5f5f5', 0.9),
    floatActive: rgba('#85baf6', 0.9),
    contextMenu: grayscale(invert('#4798f5')),
    contextMenuActive: grayscale(invert(rgba('#4798f5', 0.9))),
    popupMenu: grayscale(invert(rgba('#464b4e', 1))),
  },
  border: {
    floatActiveLayer: invert('#336cff'),
  },
  colors: lightColor,
  exactColors: baseColors,
}

export type ThemeType = typeof theme
