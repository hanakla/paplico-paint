import { css } from 'styled-components'
import { rgba } from 'polished'
import { styleWhen } from '@hanakla/arma'

export const scrollBar = css`
  ::-webkit-scrollbar {
    width: 8px;
  }

  /*スクロールバーの軌道*/
  ::-webkit-scrollbar-track {
    /* box-shadow: inset 0 0 6px rgba(0, 0, 0, .1); */
    background-color: ${({ theme }) => theme.colors.black20};
  }

  /*スクロールバーの動く部分*/
  ::-webkit-scrollbar-thumb {
    background-color: ${({ theme }) => theme.colors.black40};
    border-radius: 10px;
    box-shadow: ${({ theme }) =>
      `inset 0 0 0 1px ${theme.exactColors.blackFade20}`};
  }
`

export const rangeThumb = css`
  height: 4px;
  margin: 0;
  appearance: none;
  border-radius: 100px;

  &::-webkit-slider-thumb {
    appearance: none;
    background: #fff;
    width: 16px;
    height: 16px;
    border-radius: 100px;
    background-color: #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  }
`
export const centering = ({
  x = true,
  y = true,
}: {
  x?: boolean
  y?: boolean
} = {}) => css`
  display: flex;
  ${styleWhen(x)`justify-content: center;`}
  ${styleWhen(y)`align-items: center;`}
`

export const focusRing = css`
  &:active,
  &:focus {
    box-shadow: 0 0 0 2px ${rgba('#3694f6', 0.8)};
  }
`

export const floatingDropShadow = css`
  box-shadow: 0 0 5px ${rgba('#000', 0.3)};
`

export const checkerBoard = ({
  size,
  opacity = 0.2,
}: {
  size: number
  opacity?: number
}) => css`
  background-image: linear-gradient(
      45deg,
      rgba(0, 0, 0, ${opacity}) 25%,
      transparent 25%,
      transparent 75%,
      rgba(0, 0, 0, ${opacity}) 75%
    ),
    linear-gradient(
      45deg,
      rgba(0, 0, 0, ${opacity}) 25%,
      transparent 25%,
      transparent 75%,
      rgba(0, 0, 0, ${opacity}) 75%
    );
  /* background-color: transparent; */
  background-size: ${size}px ${size}px;
  background-position: 0 0, ${size / 2}px ${size / 2}px;
`
