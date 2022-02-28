import { css } from 'styled-components'
import { rgba } from 'polished'
import { styleWhen } from '@hanakla/arma'

export const silkScroll = css`
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