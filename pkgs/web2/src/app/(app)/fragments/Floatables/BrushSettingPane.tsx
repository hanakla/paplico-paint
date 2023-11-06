import { memo, useEffect, useRef } from 'react'
import { usePaplicoInstance, useEngineStore } from '@/domains/engine'
import { FloatablePaneIds } from '@/domains/floatablePanes'
import { FloatablePane } from '@/components/FloatablePane'
import { Listbox, ListboxItem } from '@/components/Listbox'
import { Box } from '@radix-ui/themes'
import useEvent from 'react-use-event-hook'
import { css } from 'styled-components'
import { type Paplico, type MicroCanvas, Brushes } from '@paplico/core-new'
import { FieldSet } from '@/components/FilterPane/FieldSet'
import { Slider } from '@/components/FilterPane/Slider'
import { useTranslation } from '@/lib/i18n'
import { brushesSettingPaneTexts } from '@/locales'
import useMeasure from 'use-measure'

export const BrushSettingPane = memo(function BrushSetting() {
  const t = useTranslation(brushesSettingPaneTexts)
  const { pplc: pap, canvasEditor: editorHandle } = usePaplicoInstance()
  const { currentBrush } = useEngineStore((s) => ({
    currentBrush: s.engineState?.currentBrush,
  }))

  const previewRef = useRef<HTMLCanvasElement | null>(null)
  const canvasRect = useMeasure(previewRef)
  const microCanvasRef = useRef<MicroCanvas | null>(null)

  const handleChangeBrush = useEvent((value: string[]) => {
    const target = pap!.brushes.brushEntries.find(
      (entry) => entry.metadata.id === value[0],
    )

    if (!target) return

    pap!.setBrushSetting({
      brushId: target.metadata.id,
      brushVersion: '0.0.1',
      specific: {},
    })
  })

  const handleChangeBrushSize = useEvent((value: number) => {
    editorHandle?.showBrushSizePreview(value, { durationMs: 800 })
    pap!.setBrushSetting({
      size: value,
    })
  })

  useEffect(() => {
    if (!pap || !previewRef.current) return

    const mc = (microCanvasRef.current = pap.createMicroCanvas(
      previewRef.current!.getContext('2d')!,
    ))

    return () => {
      mc.dispose()
    }
  }, [pap, previewRef.current])

  useEffect(() => {
    if (!microCanvasRef.current) return

    console.log('canvasRect', canvasRect)

    const cx = previewRef.current!.getContext('2d')!
    const mc = microCanvasRef.current
    mc.setBrushSetting({
      brushId: Brushes.CircleBrush.metadata.id,
      brushVersion: Brushes.CircleBrush.metadata.version,
      color: { r: 0, g: 0, b: 0 },
      opacity: 1,
      size: 10,
      settings: { lineCap: 'round' } satisfies Brushes.CircleBrush.Settings,
    })

    // cx.clearRect(0, 0, cx.canvas.width, cx.canvas.height)
    // mc.
  }, [canvasRect, currentBrush])

  return (
    <FloatablePane paneId={FloatablePaneIds.brushSettings} title={t('title')}>
      <div
        css={css`
          margin-bottom: 8px;
        `}
      >
        <Listbox
          value={currentBrush ? [currentBrush.brushId] : []}
          onChange={handleChangeBrush}
        >
          {pap?.brushes.brushEntries.map((entry) => (
            <ListboxItem key={entry.metadata.id} value={entry.metadata.id}>
              {entry.metadata.name}
            </ListboxItem>
          ))}
        </Listbox>
      </div>

      <div>
        <Box
          css={css`
            padding: 4px 8px;
            background-color: var(--gray-3);
            border-radius: 4px;
          `}
        >
          <canvas
            ref={previewRef}
            css={css`
              width: 100%;
              height: 40px;
            `}
          />

          <FieldSet
            title={t('size')}
            displayValue={currentBrush?.size ?? 0}
            inputs={
              <Slider
                min={0.1}
                max={200}
                step={0.1}
                value={currentBrush?.size ?? 0}
                onChange={handleChangeBrushSize}
              />
            }
          />

          <CustomPane />
        </Box>
      </div>
    </FloatablePane>
  )
})

const CustomPane = memo(function CustomPane() {
  const { pplc: pap } = usePaplicoInstance()

  const { currentBrush } = useEngineStore((s) => ({
    currentBrush: s.engineState?.currentBrush,
  }))

  const onSettingsChange = useEvent((settings: Paplico.BrushSetting) => {
    pap!.setBrushSetting(settings)
  })

  const brushSetting = currentBrush
  const BrushClass = pap?.brushes.getClass(currentBrush?.brushId ?? '')

  return (
    BrushClass &&
    brushSetting &&
    pap?.paneUI.renderBrushPane(BrushClass?.metadata.id, brushSetting, {
      onSettingsChange,
    })
  )
})
