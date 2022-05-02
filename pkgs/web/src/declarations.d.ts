import { ThemeType } from '../utils/theme'

declare module 'styled-components' {
  export interface DefaultTheme extends ThemeType {}
}

declare module 'audio-worklet' {
  export const AudioWorklet = (url: URL) => URL
}

export {}
