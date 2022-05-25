import { createGlobalStyle } from 'styled-components'
import reset from 'styled-reset'
import { media } from '🙌/utils/responsive'

export const GlobalStyle = createGlobalStyle`
  ${reset}

  *, *::before, *::after {
    box-sizing: border-box;
  }

  * {
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }

  *:not(input, textarea, button) {
    user-select: none;
  }

  * {
    transition: .1s ease-in-out;
    transition-property: color, background-color;
  }

  html, body , #__next {
    width: 100vw;
    height: 100vh;
    font-size: 12px;
    line-height: 14px;
    /* overflow: hidden; */
    font-family: -apple-system, Roboto, Ubuntu, Cantarell, 'Noto Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;
    line-height: 1.2;
    touch-action: none;

    ${media.narrow`
      font-size: 14px;
      line-height: 16px;
    `}
  }

  *:not(input textarea) {
    user-select: none;
  }

  ${media.narrow} {
    nextjs-portal {
      display: none;
    }
  }
`
