import { css } from "styled-components";
import {rgba} from 'polished'

export const silkScroll = css`
  ::-webkit-scrollbar {
      width: 8px;
  }

  /*スクロールバーの軌道*/
  ::-webkit-scrollbar-track {
    /* box-shadow: inset 0 0 6px rgba(0, 0, 0, .1); */
    background-color: #333;
  }

  /*スクロールバーの動く部分*/
  ::-webkit-scrollbar-thumb {
    background-color: ${rgba('#fff', .3)};
    border-radius: 10px;
    box-shadow: inset 0 0 0 1px #333;
  }
`

export const rangeThumb = css`
  height: 4px;
  margin: 0;
  appearance: none;
  border-radius: 100px;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    background: #fff;
    width: 16px;
    height: 16px;
    border-radius: 100px;
    background-color: #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  }
`
