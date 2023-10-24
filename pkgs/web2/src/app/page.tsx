'use client'

import { memo, useRef } from 'react'
import { css } from 'styled-components'
import { EditorArea } from './fragments/EditorArea'
import { usePaplicoInit } from '../domains/paplico'
import { LeftSideBar } from './fragments/LeftSideBar'
import { useIsMobileDevice } from '@/utils/hooks'

export default memo(function Index() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isMobile = useIsMobileDevice()

  usePaplicoInit(canvasRef)

  return (
    <div
      css={css`
        position: relative;
        display: flex;
        width: 100%;
        height: 100%;
        pointer-events: none;
      `}
    >
      {!isMobile && (
        <LeftSideBar
          css={css`
            position: relative;
            z-index: 1;
            pointer-events: auto;
          `}
        />
      )}

      <div
        css={css`
          width: 100%;
          height: 100%;
          flex: 1;
          overflow: hidden;
        `}
      >
        <EditorArea
          css={css`
            width: 100%;
            height: 100%;
            pointer-events: auto;
          `}
          ref={canvasRef}
        />
      </div>
    </div>
  )
})
