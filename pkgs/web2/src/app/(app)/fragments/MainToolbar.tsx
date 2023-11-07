import { DragHandleDots2Icon, HamburgerMenuIcon } from '@radix-ui/react-icons'
import { TbDroplet } from 'react-icons/tb'
import { RxLayers } from 'react-icons/rx'
import { BsBrushFill, BsEraserFill } from 'react-icons/bs'
import * as Toolbar from '@radix-ui/react-toolbar'
import { forwardRef, memo, useMemo, useState } from 'react'
import { css, styled } from 'styled-components'
// import useEvent from 'react-use-event-hook'
import { useDrag } from '@use-gesture/react'
import useMeasure from 'use-measure'
import { useCombineRef, usePropsMemo } from '@/utils/hooks'
import { Popover } from '@/components/Popover'
import useEvent from 'react-use-event-hook'
import {
  usePaplicoInstance,
  initializeOnlyUseEngineStore,
} from '@/domains/engine'
import { rgbaToHSBA } from '@/components/ColorPicker'
import { LayersPane } from './Floatables/LayersPane'
import { FillSettingPane } from './MainToolbar/FillSettingPane'
import {
  ActionSheet,
  ActionSheetItem,
  ActionSheetItemGroup,
} from '@/components/ActionSheet'
import { useIsomorphicLayoutEffect, useToggle } from 'react-use'
import { useModal } from '@/components/Dialog'
import { FileSaveDialog } from '@/modals/FileSaveDialog'
import { letDownload } from '@hanakla/arma'
import { storePicker } from '@/utils/zutrand'
import { Skeleton } from '@/components/Skeleton'
import { pick } from '@/utils/object'
import { ToolSelectPane } from './MainToolbar/ToolSelectPane'
import { papColorToRGBA, useToolbarStore } from './MainToolbar/toolbar.store'
import { StrokeColorPopoverTrigger } from './MainToolbar/StrokeColorPopover'

type Props = {
  className?: string
  x: number
  y: number
  onPositionChanged: (delta: { x: number; y: number }) => void
}

export const MainToolbar = memo(
  forwardRef<HTMLDivElement, Props>(function MainToolbar(
    { className, x, y, onPositionChanged },
    ref,
  ) {
    const { pplc: pap } = usePaplicoInstance()
    const { currentBrush, strokeComposition } = initializeOnlyUseEngineStore(
      (s) => pick(s.engineState, ['currentBrush', 'strokeComposition']),
    )
    const openModal = useModal()
    const propsMemo = usePropsMemo()

    const rootRef = useCombineRef<HTMLDivElement | null>(ref)

    const [menuOpened, toggleMenuOpened] = useToggle(false)
    const [toolbarDragged, setToolbarDragged] = useState(false)

    const toolbarStore = useToolbarStore(
      storePicker(['set', 'strokeColorString']),
    )

    useIsomorphicLayoutEffect(() => {
      toolbarStore.set({
        strokeColorHSB: currentBrush
          ? rgbaToHSBA(papColorToRGBA(currentBrush.color))
          : { h: 0, s: 0, b: 0 },
      })
    }, [])

    // const fillColorHSB = useMemo(() => {
    //   return papStore.engineState?.currentFill
    //     ? rgbaToHSBA({...papColorToRGBA(papStore.engineState?.currentFill.)})
    //     : { h: 0, s: 0, b: 0 }
    // }, [])

    const bindDrag = useDrag(({ delta: [x, y], first, last }) => {
      if (first) setToolbarDragged(true)
      if (last) setToolbarDragged(false)

      onPositionChanged({ x, y })
    })

    const bbox = useMeasure(rootRef)

    const handleClickOpenMenu = useEvent(() => {
      console.log('open')
      toggleMenuOpened(true)
    })

    const handleClickNewDocument = useEvent(async () => {
      openModal(ConfirmDiscardDialog, {})
    })

    const handleClickSave = useEvent(async () => {
      toggleMenuOpened(false)

      const result = await openModal(FileSaveDialog, {})
      if (!result) {
        throw new Error('Failed to saving file')
      }

      let binary: Blob | null = null

      switch (result.type) {
        case 'paplic': {
          // binary = await pap!.exporters.paplic({})
          break
        }
        case 'png': {
          binary = await pap!.exporters.png({ dpi: 150 })
          break
        }
        case 'psd': {
          binary = await pap!.exporters.psd({ keepLayers: true })
          break
        }
      }
      if (!binary) throw new Error('Failed to exporting into file')

      const url = URL.createObjectURL(binary)
      letDownload(url)
      URL.revokeObjectURL(url)
    })

    return (
      <Toolbar.Root
        css={s.toolbarRoot}
        ref={rootRef}
        style={propsMemo.memo(
          'root-style',
          {
            left: x - bbox.width / 2,
            top: y - bbox.height / 2,
            boxShadow: toolbarDragged
              ? '0px 4px 24px var(--slate-a7)'
              : undefined,
          },
          [x, y, toolbarDragged],
        )}
        aria-label="Formatting options"
        className={className}
      >
        <span role="none" css={s.drag} {...bindDrag()}>
          <DragHandleDots2Icon width={28} height={28} />
        </span>
        <div onClick={handleClickOpenMenu}>
          <HamburgerMenuIcon width={28} height={28} />
        </div>

        <ActionSheet
          opened={menuOpened}
          fill={false}
          onClose={() => toggleMenuOpened(false)}
        >
          <ActionSheetItemGroup>
            <ActionSheetItem onClick={handleClickNewDocument}>
              New paper
            </ActionSheetItem>
          </ActionSheetItemGroup>

          <ActionSheetItemGroup>
            <ActionSheetItem onClick={handleClickSave}>Save</ActionSheetItem>
          </ActionSheetItemGroup>

          <ActionSheetItemGroup>
            <ActionSheetItem onClick={toggleMenuOpened}>Cancel</ActionSheetItem>
          </ActionSheetItemGroup>
        </ActionSheet>

        <Popover
          trigger={
            <div>
              {strokeComposition === 'normal' ? (
                <BsBrushFill size={24} />
              ) : strokeComposition === 'erase' ? (
                <BsEraserFill size={24} />
              ) : (
                <Skeleton width={24} height={24} />
              )}
            </div>
          }
          side="top"
        >
          <ToolSelectPane />
        </Popover>

        <Popover
          trigger={propsMemo.memo(
            'fillsetting-popover-trigger',
            () => (
              <svg width={32} height={32} viewBox="0 0 32 32">
                <circle
                  cx={16}
                  cy={16}
                  r={12}
                  stroke={toolbarStore.strokeColorString}
                  strokeWidth={2}
                  fill={toolbarStore.strokeColorString}
                />
              </svg>
            ),
            [toolbarStore.strokeColorString],
          )}
          side="top"
        >
          <FillSettingPane />
        </Popover>

        <StrokeColorPopoverTrigger />

        <Popover
          trigger={
            <div>
              <TbDroplet size={30} />
            </div>
          }
          side="top"
        >
          <div>Inks</div>
        </Popover>

        <Popover
          trigger={
            <div>
              <RxLayers size={32} />
            </div>
          }
          side="top"
        >
          <LayersPane size="lg" />
        </Popover>
      </Toolbar.Root>
    )
  }),
)

const s = {
  toolbarRoot: css`
    position: absolute;
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 10px 16px;
    width: 100%;
    width: max-content;
    min-width: max-content;
    border-radius: 100px;
    background-color: #fff;
    box-shadow: 0 2px 10px var(--slate-a6);
    transition: box-shadow 0.2s ease-in-out;

    svg {
      vertical-align: bottom;
      color: var(--accent-7);
    }
  `,
  drag: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    font-size: 32px;
    touch-action: none;
  `,
  item: css`
    all: unset;

    flex: 0 0 auto;
    color: var(--mauve-11);
    height: 25px;
    padding: 0 5px;
    border-radius: 4px;
    display: inline-flex;
    font-size: 13px;
    line-height: 1;
    align-items: center;
    justify-content: center;

    &:hover {
      background-color: var(--violet-3);
      color: var(--violet-11);
    }
    &:focus {
      position: relative;
      box-shadow: 0 0 0 2px var(--violet-7);
    }

    background-color: white;
    margin-left: 2px;

    &:first-child {
      margin-left: 0;
    }

    &[data-state='on'] {
      background-color: var(--violet-5);
      color: var(--violet-11);
    }
  `,
  separator: css`
    width: 1px;
    height: 20px;
    background-color: var(--mauve-6);
    margin: 0 10px;
  `,
  button: css`
    all: unset;
    padding-left: 10px;
    padding-right: 10px;
    color: white;
    background-color: var(--violet-9);

    &:hover {
      background-color: var(--violet-10);
      color: white;
    }
  `,
}

const HuePointer = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'color',
})`
  width: 10px;
  height: 10px;
  border: 1px solid #fff;
  box-shadow:
    inset 0 0 0 0.5px #000,
    0 0 0 0.5px #000;
  border-radius: 100px;
  transform: translate(-50%, -50%);
`

const Pointer = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'color',
})`
  width: 12px;
  height: 12px;
  border-radius: 100px;
  background-color: var(--gray-9);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
`
