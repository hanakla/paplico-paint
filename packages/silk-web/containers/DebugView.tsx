import { useEffect, useRef } from 'react'
import { useMedia } from 'react-use'
import styled from 'styled-components'
import { useSilkEngine } from '../hooks/useSilkEngine'
import { narrow } from '../utils/responsive'

export const DebugView = ({ className }: { className?: string }) => {
  const engine = useSilkEngine()
  const isNarrow = useMedia(`(max-width: ${narrow})`)

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

    strokeViewRef.current!.appendChild((engine as any).strokeCanvasCtx.canvas)
    bufferViewRef.current!.appendChild((engine as any).__dbg_bufferCtx.canvas)
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
      style={{ transform: isNarrow ? 'scale(.5)' : undefined }}
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
