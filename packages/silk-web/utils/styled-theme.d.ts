import type { CSSProp } from 'styled-components'
import type {} from 'styled-components/cssprop'
import { theme, ThemeType } from './theme'

declare module 'styled-components' {
  interface DefaultTheme extends ThemeType {}
}

declare module 'react' {
  interface DOMAttributes<T> {
    css?: CSSProp<ThemeType>
  }
}

declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      css?: CSSProp<ThemeType>
    }
  }
}
