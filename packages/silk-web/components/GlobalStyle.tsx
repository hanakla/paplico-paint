import { createGlobalStyle } from 'styled-components'
import reset from 'styled-reset'

export const GlobalStyle = createGlobalStyle<{ isNarrow: boolean }>`
  ${reset}

  *, *::before, *::after {
    box-sizing: border-box;
  }

  * {
    -webkit-tap-highlight-color: transparent;
  }

  * {
    transition: .1s ease-in-out;
    transition-property: color, background-color;
  }

  html, body , #__next {
    width: 100%;
    height: 100%;
    font-size: ${({ isNarrow }) => (isNarrow ? '14px' : '12px')};
    line-height: ${({ isNarrow }) => (isNarrow ? '16px' : '14px')};
    overflow: hidden;
    font-family: -apple-system, Roboto, Ubuntu, Cantarell, 'Noto Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;
    line-height: 1.2;
  }

  *:not(input) {
    user-select: none;
  }
`
