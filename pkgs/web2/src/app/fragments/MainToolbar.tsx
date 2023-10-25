import {
  DragHandleDots2Icon,
  FontBoldIcon,
  FontItalicIcon,
  HamburgerMenuIcon,
  LayersIcon,
  StrikethroughIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
} from '@radix-ui/react-icons'
import { TbDroplet } from 'react-icons/tb'
import { RxLayers } from 'react-icons/rx'
import { BsBrushFill, BsEraserFill } from 'react-icons/bs'
import { Document } from '@paplico/core-new'
import * as Toolbar from '@radix-ui/react-toolbar'
import {
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
  forwardRef,
  memo,
  useMemo,
  useReducer,
} from 'react'
import { css, styled } from 'styled-components'
// import useEvent from 'react-use-event-hook'
import { useDrag } from '@use-gesture/react'
import { useState } from 'react'
import useMeasure from 'use-measure'
import { useCombineRef } from '@/utils/hooks'
import { Popover } from '@/components/Popover'
import useEvent from 'react-use-event-hook'
import { rgbToColorString } from 'polished'
import { TextField } from '@/components/TextField'
import {
  DEFAULT_BRUSH_ID,
  DEFAULT_BRUSH_VERSION,
  usePaplico,
} from '@/domains/paplico'
import {
  Alpha,
  ColorChangeHandler,
  ColorTypes,
  Hue,
  Saturation,
  hsbaToRGBA,
  rgbaToHSBA,
} from '@/components/ColorPicker'
import { LayersPane } from './Floatables/LayersPane'
import { FillSettingPane } from './MainToolbar/FillSettingPane'
import {
  ActionSheet,
  ActionSheetItem,
  ActionSheetItemGroup,
} from '@/components/ActionSheet'
import { useToggle } from 'react-use'
import { useModal } from '@/components/Dialog'
import { FileSaveDialog } from './MainToolbar/FileSaveDialog'
import { letDownload } from '@hanakla/arma'

type Props = {
  className?: string
  x: number
  y: number
  onPositionChanged: (delta: { x: number; y: number }) => void
}

function papColorToRGBA(
  color: Document.ColorRGB | Document.ColorRGBA,
): ColorTypes.RGBA {
  return {
    r: color.r * 255,
    g: color.g * 255,
    b: color.b * 255,
    a: 'a' in color ? color.a : undefined,
  }
}

function rgbaToPapColor(color: {
  r: number
  g: number
  b: number
  a?: number
}) {
  return {
    r: color.r / 255,
    g: color.g / 255,
    b: color.b / 255,
    a: color.a ?? 1,
  }
}

export const MainToolbar = memo(
  forwardRef<HTMLDivElement, Props>(function MainToolbar(
    { className, x, y, onPositionChanged },
    ref,
  ) {
    const { pap, papStore } = usePaplico()
    const openModal = useModal()

    const rootRef = useCombineRef<HTMLDivElement | null>(ref)

    const [menuOpened, toggleMenuOpened] = useToggle(false)

    const [strokeColorHSB, setStrokeColorHSB] = useState<ColorTypes.HSBA>(
      () => {
        return papStore.engineState?.currentStroke
          ? rgbaToHSBA(
              papColorToRGBA(papStore.engineState?.currentStroke.color),
            )
          : { h: 0, s: 0, b: 0 }
      },
    )

    // const fillColorHSB = useMemo(() => {
    //   return papStore.engineState?.currentFill
    //     ? rgbaToHSBA({...papColorToRGBA(papStore.engineState?.currentFill.)})
    //     : { h: 0, s: 0, b: 0 }
    // }, [])

    const bindDrag = useDrag(({ delta: [x, y] }) => {
      onPositionChanged({ x, y })
    })

    const bbox = useMeasure(rootRef)

    const handleChangeStrokeColor = useEvent<ColorChangeHandler>((color) => {
      setStrokeColorHSB(color.hsb)

      pap!.setStrokeSetting({
        color: rgbaToPapColor(color.rgb),
      })
    })

    const handleClickOpenMenu = useEvent(() => {
      console.log('open')
      toggleMenuOpened(true)
    })

    const handleClickTool = useEvent((e: MouseEvent<HTMLElement>) => {
      const type = e.currentTarget.dataset.type!

      if (type === 'brush') {
        pap?.setStrokeCompositionMode('normal')
      } else if (type === 'eraser') {
        pap?.setStrokeCompositionMode('erase')
      }
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
          binary = await pap!.exporters.png({})
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

    const fillColor = useMemo(() => {}, [])

    const strokeColor = useMemo(() => {
      const color = hsbaToRGBA(strokeColorHSB)
      return {
        rgba: color,
        string: rgbToColorString({
          red: color.r,
          green: color.g,
          blue: color.b,
        }),
      }
    }, [strokeColorHSB])

    return (
      <Toolbar.Root
        css={s.toolbarRoot}
        ref={rootRef}
        style={{
          left: x - bbox.width / 2,
          top: y - bbox.height / 2,
        }}
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
          <ActionSheetItem onClick={handleClickSave}>Save</ActionSheetItem>
        </ActionSheet>

        <Popover
          trigger={
            <div>
              {/* {console.log()} */}
              {papStore.engineState?.strokeComposition === 'normal' ? (
                <BsBrushFill size={24} />
              ) : (
                <BsEraserFill size={24} />
              )}
            </div>
          }
          side="top"
        >
          <ul
            css={css`
              padding: 2px 0;
            `}
          >
            <ToolItem onClick={handleClickTool} data-type="brush">
              <BsBrushFill css={s.toolIcon} size={28} />
              Brush
            </ToolItem>

            <ToolItem onClick={handleClickTool} data-type="eraser">
              <BsEraserFill css={s.toolIcon} size={28} />
              Eraser
            </ToolItem>
          </ul>
        </Popover>

        <Popover
          trigger={
            <svg width={32} height={32} viewBox="0 0 32 32">
              <circle
                cx={16}
                cy={16}
                r={12}
                stroke={strokeColor.string}
                strokeWidth={2}
                fill={strokeColor.string}
              />
            </svg>
          }
          side="top"
        >
          <FillSettingPane />
        </Popover>

        <Popover
          trigger={
            <svg width={32} height={32} viewBox="0 0 32 32">
              <line
                stroke={strokeColor.string}
                strokeWidth={2}
                strokeLinecap="round"
                x1={8}
                y1={8}
                x2={24}
                y2={24}
              />
            </svg>
          }
          side="top"
        >
          <div
            css={css`
              display: flex;
              flex-flow: column;
              gap: 8px;
            `}
          >
            <Saturation
              css={css`
                width: 100%;
                aspect-ratio: 1;
              `}
              color={strokeColorHSB}
              onChange={handleChangeStrokeColor}
              onChangeComplete={handleChangeStrokeColor}
            />
            <Hue
              color={strokeColorHSB}
              onChange={handleChangeStrokeColor}
              onChangeComplete={handleChangeStrokeColor}
            />
            <Alpha
              color={strokeColorHSB}
              onChange={handleChangeStrokeColor}
              onChangeComplete={handleChangeStrokeColor}
            />
          </div>
        </Popover>

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

        {/* <Toolbar.ToggleGroup type="multiple" aria-label="Text formatting">
          <Toolbar.ToggleItem
            css={css`
              ${s.item}
            `}
            value="bold"
            aria-label="Bold"
          >
            <FontBoldIcon />
          </Toolbar.ToggleItem>
          <Toolbar.ToggleItem
            css={css`
              ${s.item}
            `}
            value="italic"
            aria-label="Italic"
          >
            <FontItalicIcon />
          </Toolbar.ToggleItem>
          <Toolbar.ToggleItem
            css={css`
              ${s.item}
            `}
            value="strikethrough"
            aria-label="Strike through"
          >
            <StrikethroughIcon />
          </Toolbar.ToggleItem>
        </Toolbar.ToggleGroup>
        <Toolbar.Separator css={s.separator} />
        <Toolbar.ToggleGroup
          type="single"
          defaultValue="center"
          aria-label="Text alignment"
        >
          <Toolbar.ToggleItem
            css={s.item}
            value="left"
            aria-label="Left aligned"
          >
            <TextAlignLeftIcon />
          </Toolbar.ToggleItem>
          <Toolbar.ToggleItem
            css={s.item}
            value="center"
            aria-label="Center aligned"
          >
            <TextAlignCenterIcon />
          </Toolbar.ToggleItem>
          <Toolbar.ToggleItem
            css={s.item}
            value="right"
            aria-label="Right aligned"
          >
            <TextAlignRightIcon />
          </Toolbar.ToggleItem>
        </Toolbar.ToggleGroup>
        <Toolbar.Separator css={s.separator} />
        <Toolbar.Link
          className="ToolbarLink"
          href="#"
          target="_blank"
          style={{ marginRight: 10 }}
        >
          Edited 2 hours ago
        </Toolbar.Link>
        <Toolbar.Button
          className="ToolbarButton"
          style={{ marginLeft: 'auto' }}
        >
          Share
        </Toolbar.Button> */}
      </Toolbar.Root>
    )
  }),
)

const s = {
  toolbarRoot: css`
    position: absolute;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px 16px;
    width: 100%;
    width: max-content;
    min-width: max-content;
    border-radius: 100px;
    background-color: #fff;
    box-shadow: 0 2px 10px var(--pap-sufrace-dropshadow);

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
  toolIcon: css`
    margin-right: 8px;
    vertical-align: bottom;
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

const ToolItem = styled.li`
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

  & + & {
    margin-top: 8px;
  }
`

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
