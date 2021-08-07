import { rgba } from 'polished'

export const theme = {
  text: {
    white: '#cfcfcf',
    sidebarWhite: '#cfcfcf',
    inputActive: '#333',
    mainActionsBlack: '#464b4e',
    contextMenuActive: '#fff',
  },
  surface: {
    black: '#a8a8a8',
    sidebarBlack: '#464b4e',
    sidebarList: '#363a3d',
    brushViewWhite: '#ccc',
    brushViewActive: rgba('#999', 0.5),
    inputActive: '#eee',
    floatWhite: rgba('#e1e1e1', 0.9),
    floatActive: rgba('#85baf6', 0.9),
    contextMenu: '#4798f5',
    contextMenuActive: rgba('#4798f5', 0.9),
  },
  border: {
    floatActiveLayer: '#336cff',
  },
}

export type ThemeType = typeof theme
