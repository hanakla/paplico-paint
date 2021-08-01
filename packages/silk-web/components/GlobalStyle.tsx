import { createGlobalStyle } from "styled-components";
import reset from 'styled-reset'

export const GlobalStyle = createGlobalStyle`
  ${reset}

  *, *::before, *::after {
    box-sizing: border-box;
  }

  * {
    -webkit-tap-highlight-color: transparent;
  }

  html, body , #__next {
    width: 100%;
    height: 100%;
    font-size: 14px;
    overflow: hidden;
  }

  *:not(input) {
    user-select: none;
  }
`
