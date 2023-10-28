import { RuleSet } from 'styled-components'

declare module 'react' {
  interface Attributes {
    css?: CSSProp | RuleSet<object> | undefined
  }
}
