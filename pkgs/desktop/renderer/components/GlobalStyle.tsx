import { createGlobalStyle } from 'styled-components'
import { reset } from 'styled-reset'

export const GlobalStyle = createGlobalStyle`
  ${reset}

  html, body, #__next {
    width: 100%;
    height: 100%;
  }
`
