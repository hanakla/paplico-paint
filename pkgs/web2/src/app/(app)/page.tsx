'use client'

import { MutableRefObject, forwardRef, memo, useRef } from 'react'
import { css } from 'styled-components'
import { EditorArea } from './fragments/EditorArea'
import { usePaplicoInit } from '../domains/paplico'
import { LeftSideBar } from './fragments/LeftSideBar'
import { useIsMobileDevice } from '@/utils/hooks'
import { GlobalShortcutHandler } from './GlobalShortcutHandler'
import { useEffectOnce } from 'react-use'

type Props = {
  // TODO
  chatMode?: boolean
}

export default memo(function Page({ chatMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isMobile = useIsMobileDevice()

  // console.log('rerender')

  usePaplicoInit(canvasRef, { chatMode })

  useEffectOnce(() => {
    if (process.env.NODE_ENV === 'development') return

    window.addEventListener('beforeunload', (e) => {
      e.preventDefault()
      e.returnValue = 'a?'
    })
  })

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
      <GlobalShortcutHandler />
      <PaplicoInit canvasRef={canvasRef} />

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

// For performance reasons, we don't want to re-render the entire app when
const PaplicoInit = memo(function PaplicoInit({
  canvasRef,
}: {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
}) {
  // usePaplicoInit(canvasRef)

  return null
})
