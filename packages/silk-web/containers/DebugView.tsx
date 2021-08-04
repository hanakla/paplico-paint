import { useEffect, useRef } from 'react'
import { SilkEngine } from 'silk-core/src/engine/Engine'
import styled from 'styled-components'
import { useSilkEngine } from '../hooks/useSilkEngine'

export const DebugView = ({ className }: { className?: string }) => {
  const engine = useSilkEngine()

  const strokeViewRef = useRef<HTMLDivElement | null>(null)
  const bufferViewRef = useRef<HTMLDivElement | null>(null)
  const strokingPreviewRef = useRef<HTMLDivElement | null>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!engine) return

    const clearChildren = (el: HTMLElement) => {
      while (el.firstChild) el.removeChild(el.lastChild!)
    }

    clearChildren(strokeViewRef.current!)
    clearChildren(bufferViewRef.current!)
    clearChildren(strokingPreviewRef.current!)
    clearChildren(previewRef.current!)

    strokeViewRef.current!.appendChild((engine as any).strokeCanvas)
    bufferViewRef.current!.appendChild((engine as any).bufferCtx.canvas)
    strokingPreviewRef.current!.appendChild(
      (engine as any).strokingPreviewCtx.canvas
    )
    previewRef.current!.appendChild((engine as any).previewCanvas)
  }, [engine])

  return (
    <div
      css={`
        display: flex;
      `}
      className={className}
    >
      <div>
        Stroke:
        <CanvasContainer ref={strokeViewRef} />
      </div>
      <div>
        Buffer:
        <CanvasContainer ref={bufferViewRef} />
      </div>
      <div>
        Stroking:
        <CanvasContainer ref={strokingPreviewRef} />
      </div>
      <div>
        Preview:
        <CanvasContainer ref={previewRef} />
      </div>
    </div>
  )
}

const CanvasContainer = styled.div`
  width: 100px;

  canvas {
    max-width: 100%;
  }
`
