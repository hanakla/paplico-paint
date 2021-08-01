import 'styled-components'
import {theme} from './theme'

declare module 'stlyed-components' {
  type T = typeof  theme

  export interface DefaultTheme extends T {}
}
