import { useCanvasEditorState } from '@/domains/engine'
import { useStableLatestRef } from '@/utils/hooks'
import { MicroCanvas, SVGConversion } from '@paplico/core-new'
import { pick } from '@paplico/shared-lib'
import { memo, useEffect, useRef } from 'react'
import { css } from 'styled-components'
import useMeasure from 'use-measure'

type Props = {
  className?: string
}

export const BrushPreviewCanvas = memo(function BrushPreviewCanvas({
  className,
}: Props) {
  const previewRef = useRef<HTMLCanvasElement | null>(null)
  const microCanvasRef = useRef<MicroCanvas | null>(null)
  const canvasRect = useMeasure(previewRef)

  const { pplc, currentBrush, currentInk, showBrushSizePreview } =
    useCanvasEditorState((s) => ({
      pplc: s.paplico,
      currentBrush: s.paplico.getBrushSetting(),
      currentInk: s.paplico.getInkSetting(),
      ...pick(s, ['showBrushSizePreview', 'paplico']),
    }))

  const rerenderStroke = useStableLatestRef(() => {
    if (!microCanvasRef.current) return

    const mc = microCanvasRef.current
    mc.setBrushSetting(currentBrush)
    currentInk && mc.setInkSetting(currentInk)

    mc.drawPath(
      SVGConversion.parseSVGPathToVisuVectorPath(
        'm1.16,34.09c39.38,35.09,140.13,72.91,261.85,10.02,121.72-62.88,232.86-48.28,283.51-10.02',
      ),
      { clearDestination: true },
    )
  })

  useEffect(() => {
    if (!pplc || !previewRef.current) return

    const mc = (microCanvasRef.current = pplc.createMicroCanvas(
      previewRef.current!.getContext('2d')!,
    ))

    return () => {
      mc.dispose()
    }
  }, [pplc, previewRef.current])

  useEffect(() => {
    return pplc?.on('brushSettingChanged', () => {
      rerenderStroke.current()
    })
  }, [pplc])

  useEffect(() => {
    const mc = microCanvasRef.current
    if (!mc) return

    return mc.on('strokeStart', () => mc.clearCanvas())
  }, [canvasRect.width, canvasRect.height, currentBrush, currentInk])

  return (
    <canvas
      ref={previewRef}
      css={css`
        width: 100%;
        height: 40px;
        border: 1px solid var(--gray-a4);
      `}
    />
  )
})
