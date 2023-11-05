import { TabPage } from '@/components/TabBar'
import { usePaplicoInstance, useEngineStore } from '@/domains/paplico'
import { MouseEvent, ReactNode, memo } from 'react'
import { BsBrushFill, BsEraserFill } from 'react-icons/bs'
import { RiCircleLine, RiRectangleFill, RiRectangleLine } from 'react-icons/ri'
import useEvent from 'react-use-event-hook'
import styled, { css } from 'styled-components'
import { VectorToolModes } from '@paplico/editor'
import { useEditorStore } from '@/domains/uiState'
import { useTranslation } from '@/lib/i18n'
import { mainToolbarTexts } from '@/locales'

export const ToolSelectPane = memo(function ToolSelectPane() {
  const t = useTranslation(mainToolbarTexts)
  const { pplc: pap, editorHandle } = usePaplicoInstance()
  const editorStore = useEditorStore()
  const paplicoStore = useEngineStore()

  const handleClickTool = useEvent((e: MouseEvent<HTMLElement>) => {
    const type = e.currentTarget.dataset.type!

    if (type === 'brush') {
      pap?.setStrokeCompositionMode('normal')
    } else if (type === 'eraser') {
      pap?.setStrokeCompositionMode('erase')
    }

    editorHandle?.setVectorToolMode(VectorToolModes.none)
  })

  const handleClickVectorTool = useEvent((e: MouseEvent<HTMLElement>) => {
    const type = e.currentTarget.dataset.type!

    editorStore.set({
      strokeCompositonBeforeChnageToVectorTool: pap!.state.strokeComposition,
    })

    if (type === 'rectangle') {
      editorHandle?.setVectorToolMode(VectorToolModes.rectangleTool)
    } else if (type === 'ellipse') {
      editorHandle?.setVectorToolMode(VectorToolModes.ellipseTool)
    }

    pap?.setStrokeCompositionMode('none')
  })

  const isVectorLayerActive =
    paplicoStore.strokeTargetVisually?.layerType === 'vector'

  return (
    <ul
      css={css`
        padding: 2px 0;
      `}>
      <TabPage.Root defaultPage="raster">
        <TabPage.Content pageId="raster">
          <ToolItem onClick={handleClickTool} data-type="brush">
            <BsBrushFill css={s.toolIcon} size={28} />
            {t('tools.brush')}
          </ToolItem>

          <ToolItem onClick={handleClickTool} data-type="eraser">
            <BsEraserFill css={s.toolIcon} size={28} />
            {t('tools.eraser')}
          </ToolItem>
        </TabPage.Content>

        <TabPage.Content pageId="vector">
          <ToolItem
            onClick={handleClickVectorTool}
            data-type="rectangle"
            disabled={!isVectorLayerActive}>
            <RiRectangleLine css={s.toolIcon} size={28} />
            {t('tools.shapeRect')}
          </ToolItem>

          <ToolItem
            onClick={handleClickVectorTool}
            data-type="ellipse"
            disabled={!isVectorLayerActive}>
            <RiCircleLine css={s.toolIcon} size={28} />
            {t('tools.shapeEllipse')}
          </ToolItem>

          <ToolItem
            onClick={handleClickVectorTool}
            data-type="brush"
            disabled={!isVectorLayerActive}>
            <BsBrushFill css={s.toolIcon} size={28} />
            {t('tools.brush')}
          </ToolItem>

          {/* <ToolItem onClick={handleClickTool} data-type="eraser">
            <BsEraserFill css={s.toolIcon} size={28} />
            Eraser
          </ToolItem> */}

          {!isVectorLayerActive && (
            <div
              css={css`
                font-size: var(--font-size-2);
                line-height: var(--line-height-1);
                margin-top: 8px;
                padding: 0 8px;
                color: var(--slate-9);
              `}>
              {t('vectorToolOnlyOnVectorLayer')}
            </div>
          )}
        </TabPage.Content>

        <TabPage.List
          css={`
            margin-top: 8px;
          `}>
          <TabPage.Tab pageId="raster">{t('tabs.normalLayer')}</TabPage.Tab>
          <TabPage.Tab pageId="vector">{t('tabs.vectorLayer')}</TabPage.Tab>
        </TabPage.List>
      </TabPage.Root>
    </ul>
  )
})

const s = {
  toolIcon: css`
    margin-right: 8px;
    vertical-align: bottom;
  `,
}

const ToolItem = memo(function ToolItem({
  children,
  disabled,
  onClick,
  ...props
}: {
  children?: ReactNode
  disabled?: boolean
  onClick?: (e: MouseEvent<HTMLLIElement>) => void
}) {
  return (
    <li
      css={css`
        display: flex;
        align-items: center;
        width: 100%;
        padding: 8px;
        cursor: pointer;
        user-select: none;
        border-radius: 4px;

        &:hover {
          color: var(--gray-1);
          background-color: var(--teal-8);
        }

        &[aria-disabled='true'] {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }

        & + & {
          margin-top: 8px;
        }
      `}
      aria-disabled={disabled}
      {...props}
      onClick={onClick}>
      {children}
    </li>
  )
})
