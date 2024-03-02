import { TabPage } from '@/components/TabBar'
import { usePaplicoInstance } from '@/domains/engine'
import { MouseEvent, ReactNode, memo } from 'react'
import { BsBrushFill, BsEraserFill } from 'react-icons/bs'
import { RiCircleLine, RiCursorFill, RiRectangleLine } from 'react-icons/ri'
import useEvent from 'react-use-event-hook'
import { css } from 'styled-components'
import { ToolModes } from '@paplico/editor'
import { useEditorStore } from '@/domains/uiState'
import { useTranslation } from '@/lib/i18n'
import { mainToolbarTexts } from '@/locales'
import { GhostButton } from '@/components/GhostButton'

export const ToolSelectPane = memo(function ToolSelectPane() {
  const t = useTranslation(mainToolbarTexts)
  const { pplc, canvasEditor } = usePaplicoInstance()
  const editorStore = useEditorStore()

  const handleClickTool = useEvent((e: MouseEvent<HTMLElement>) => {
    const type = e.currentTarget.dataset.type!

    if (type === 'brush') {
      pplc?.setStrokeCompositionMode('normal')
    } else if (type === 'eraser') {
      pplc?.setStrokeCompositionMode('erase')
    }

    canvasEditor?.setToolMode(ToolModes.none)
  })

  const handleClickVectorTool = useEvent((e: MouseEvent<HTMLElement>) => {
    const type = e.currentTarget.dataset.type!

    editorStore.set({
      strokeCompositonBeforeChnageToVectorTool: pplc!.state.strokeComposition,
    })

    if (type === 'rectangle') {
      canvasEditor?.setToolMode(ToolModes.rectangleTool)
    } else if (type === 'ellipse') {
      canvasEditor?.setToolMode(ToolModes.ellipseTool)
    }

    pplc?.setStrokeCompositionMode('none')
  })

  const isCanvasVisuTarget =
    canvasEditor?.getStrokingTarget()?.visuType === 'canvas'

  return (
    <div>
      <TabPage.Root
        css={css`
          max-width: calc(100vw - 32px);
        `}
        defaultPage="raster"
      >
        <TabPage.Content pageId="raster">
          <div
            css={css`
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
            `}
          >
            <ToolItem
              name={t('tools.brush')}
              onClick={handleClickTool}
              data-type="brush"
            >
              <BsBrushFill css={s.toolIcon} size={28} />
              {t('tools.brush')}
            </ToolItem>

            <ToolItem
              onClick={handleClickTool}
              data-type="eraser"
              name={t('tools.eraser')}
              disabled={!isCanvasVisuTarget}
            >
              <BsEraserFill css={s.toolIcon} size={28} />
              {t('tools.eraser')}
            </ToolItem>

            <ToolItem
              css={`
                grid-column-start: 1;
              `}
              onClick={handleClickVectorTool}
              data-type="rectangle"
              name={t('tools.objectTool')}
            >
              <RiCursorFill css={s.toolIcon} size={28} />
              {t('tools.objectTool')}
            </ToolItem>

            <ToolItem
              onClick={handleClickVectorTool}
              data-type="rectangle"
              name={t('tools.shapeRect')}
            >
              <RiRectangleLine css={s.toolIcon} size={28} />
              {t('tools.shapeRect')}
            </ToolItem>

            <ToolItem
              onClick={handleClickVectorTool}
              data-type="ellipse"
              name={t('tools.shapeEllipse')}
            >
              <RiCircleLine css={s.toolIcon} size={28} />
              {t('tools.shapeEllipse')}
            </ToolItem>
          </div>

          {/* <ToolItem onClick={handleClickTool} data-type="eraser">
            <BsEraserFill css={s.toolIcon} size={28} />
            Eraser
          </ToolItem> */}

          {!isCanvasVisuTarget && (
            <div
              css={css`
                font-size: var(--font-size-2);
                line-height: var(--line-height-1);
                margin-top: 8px;
                padding: 0 8px;
                color: var(--slate-9);
              `}
            >
              {t('vectorToolOnlyOnVectorLayer')}
            </div>
          )}
        </TabPage.Content>

        <TabPage.List
          css={`
            margin-top: 8px;
          `}
        >
          <TabPage.Tab pageId="raster">{t('tabs.normalLayer')}</TabPage.Tab>
          <TabPage.Tab pageId="vector">{t('tabs.vectorLayer')}</TabPage.Tab>
        </TabPage.List>
      </TabPage.Root>
    </div>
  )
})

const s = {
  toolIcon: css`
    vertical-align: bottom;
  `,
}

const ToolItem = memo(function ToolItem({
  children,
  disabled,
  onClick,
  name,
  ...props
}: {
  children?: ReactNode
  disabled?: boolean
  name: string
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <GhostButton
      tabIndex={0}
      css={css`
        display: inline-flex;
        flex-flow: column;
        gap: 8px;
        justify-content: center;
        align-items: center;
        aspect-ratio: 1 / 1;
        cursor: pointer;
        user-select: none;
        border-radius: 4px;
        transition-property: background-color, color;
        transition: 0.2s ease-in-out;
        background-color: var(--gray-2);
        line-height: 1;
        vertical-align: bottom;
        text-align: center;

        &:hover {
          color: var(--gray-1);
          background-color: var(--teal-8);
        }

        &[aria-disabled='true'] {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }
      `}
      disabled={disabled}
      aria-disabled={disabled}
      onClick={onClick}
      {...props}
      aria-label={name}
    >
      {children}
    </GhostButton>
  )
})
