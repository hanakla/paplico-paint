import {
  ChangeEvent,
  MouseEvent,
  useCallback,
  useContext,
  useReducer,
  useRef,
  useState,
} from 'react'
import { ChromePicker, ColorChangeHandler } from 'react-color'
import { rgba } from 'polished'
import { usePopper } from 'react-popper'
import { useEffect } from 'react'
import { SilkBrushes } from 'silk-core'
import { useTranslation } from 'next-i18next'
import { useLysSlice } from '@fleur/lys'
import { useClickAway, useMedia, useToggle, useUpdate } from 'react-use'
import {
  Brush,
  Close,
  Eraser,
  Pencil,
  Shape,
  Stack,
} from '@styled-icons/remix-line'
import { Cursor } from '@styled-icons/remix-fill'
import { useTheme } from 'styled-components'
import { useSilkEngine } from '../../hooks/useSilkEngine'
import { rangeThumb } from '../../utils/mixins'
import { Portal } from '../../components/Portal'
import { narrow } from '../../utils/responsive'
import { FloatMenu } from '../../components/FloatMenu'
import { LayerFloatMenu } from './LayerFloatMenu'
import { EditorSlice } from '../../domains/Editor'
import { useLayerControl } from '../../hooks/useLayers'

export function MainActions() {
  const { t } = useTranslation()
  const engine = useSilkEngine()
  const [editorState, editorActions] = useLysSlice(EditorSlice)
  const theme = useTheme()
  const isNarrowMedia = useMedia(`(max-width: ${narrow})`)
  const layerControls = useLayerControl()

  const [color, setColor] = useState({ r: 0, g: 0, b: 0 })
  const [openPicker, togglePicker] = useToggle(false)
  const [openBrush, toggleBrush] = useToggle(false)
  const [openLayers, toggleLayers] = useToggle(false)
  const [weight, setWeight] = useState(1)
  const [brushOpacity, setBrushOpacity] = useState(1)
  const rerender = useUpdate()

  const handleChangeColor: ColorChangeHandler = useCallback((color) => {
    setColor(color.rgb)
  }, [])

  const handleChangeCompleteColor: ColorChangeHandler = useCallback(
    (color) => {
      setColor(color.rgb)

      engine!.brushSetting = {
        ...engine!.brushSetting,
        color: color.rgb,
      }
    },
    [engine]
  )

  const handleChangeBrushOpacity = useCallback(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!engine) return
      setBrushOpacity(currentTarget.valueAsNumber)

      engine!.brushSetting = {
        ...engine!.brushSetting,
        opacity: currentTarget.valueAsNumber,
      }
    },
    [engine]
  )

  const handleChangeWeight = useCallback(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!engine) return

      setWeight(currentTarget.valueAsNumber)

      engine.brushSetting = {
        ...engine.brushSetting,
        weight: currentTarget.valueAsNumber,
      }
    },
    [engine]
  )

  const handleChangeToCursorMode = useCallback(() => {
    editorActions.setTool('cursor')
  }, [])

  const handleChangeToShapePenMode = useCallback(() => {
    editorActions.setTool('shape-pen')
  }, [])

  const handleChangeToPencilMode = useCallback(() => {
    if (editorState.currentTool === 'draw') {
      toggleBrush(true)
      return
    }

    editorActions.setTool('draw')
  }, [editorState])

  const handleChangeToEraceMode = useCallback(() => {
    editorActions.setTool('erase')
  }, [engine])

  const handleChangeBrush = useCallback(
    (id: keyof typeof SilkBrushes) => {
      if (!engine) return

      engine.setBrush(SilkBrushes[id])
      rerender()
    },
    [engine]
  )

  const handleClickColor = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (pickerPopRef.current!.contains(e.target as HTMLElement)) return
    togglePicker()
  }, [])

  const handleClickLayerIcon = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (layerPopRef.current!.contains(e.target as HTMLElement)) return
    toggleLayers()
  }, [])

  const brushRef = useRef<HTMLDivElement | null>(null)
  const brushPopRef = useRef<HTMLDivElement | null>(null)
  const brushPopper = usePopper(brushRef.current, brushPopRef.current, {
    strategy: 'fixed',
    placement: 'top-start',
  })

  const layerRef = useRef<HTMLDivElement | null>(null)
  const layerPopRef = useRef<HTMLDivElement | null>(null)
  const layerPopper = usePopper(layerRef.current, layerPopRef.current, {
    strategy: 'absolute',
    placement: 'top-end',
  })

  const pickerPopRef = useRef<HTMLDivElement | null>(null)
  useClickAway(pickerPopRef, () => togglePicker(false))
  useClickAway(brushPopRef, () => toggleBrush(false))
  useClickAway(layerPopRef, () => toggleLayers(false))

  return (
    <div
      css={`
        display: flex;
        gap: 8px;
        padding: 8px 16px;
        background-color: ${rgba('#ccc', 0.8)};
        border-radius: 100px;
        color: ${({ theme }) => theme.text.mainActionsBlack};
        border: 1px solid #aaa;
        white-space: nowrap;
      `}
    >
      <div
        css={`
          display: flex;
          flex-flow: column;
        `}
      >
        <div>
          <div
            css={`
              position: relative;

              &::before {
                content: '';
                display: block;
                position: absolute;
                top: 50%;
                left: 0;
                width: 0;
                height: 0;
                border-style: solid;
                border-width: 4px 120px 4px 0;
                border-color: transparent #ddd transparent transparent;
                height: 0;
                background-color: transparent;
                border-radius: 100px;
                transform: translateY(-50%);
              }
            `}
          >
            <input
              css={`
                position: relative;
                z-index: 1;
                width: 100px;
                height: 8px;
                vertical-align: bottom;
                appearance: none;
                border-radius: 100px;
                background: transparent;
                transform: translateY(-5px);
                ${rangeThumb}
              `}
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={weight}
              onChange={handleChangeWeight}
            />
          </div>
        </div>
        <div>
          <input
            css={`
              width: 100px;
              height: 8px;
              vertical-align: bottom;
              appearance: none;
              background: linear-gradient(
                to right,
                ${rgba(color.r, color.g, color.b, 0)},
                ${rgba(color.r, color.g, color.b, 1)}
              );
              border-radius: 100px;

              ${rangeThumb}
            `}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={brushOpacity}
            onChange={handleChangeBrushOpacity}
          />
        </div>
      </div>

      <div>
        {layerControls.activeLayer?.layerType === 'raster' ? (
          <div
            css={`
              display: inline-block;
              position: relative;
              width: 32px;
              height: 32px;
              border: 2px solid #dbdbdb;
              vertical-align: middle;
              box-shadow: 0 0 2px 1px rgba(0, 0, 0, 0.4);
            `}
            style={{ backgroundColor: rgba(color.r, color.g, color.b, 1) }}
            onClick={handleClickColor}
          >
            <div
              ref={pickerPopRef}
              style={{
                ...(openPicker
                  ? { opacity: 1, pointerEvents: 'all' }
                  : { opacity: 0, pointerEvents: 'none' }),
              }}
              data-ignore-click
            >
              <ChromePicker
                css={`
                  position: absolute;
                  left: 50%;
                  bottom: 100%;
                  transform: translateX(-50%);
                `}
                color={color}
                onChange={handleChangeColor}
                onChangeComplete={handleChangeCompleteColor}
                disableAlpha
              />
            </div>
          </div>
        ) : (
          <div
            css={`
              position: relative;
              width: 32px;
              height: 32px;
              overflow: hidden;
            `}
          >
            {/* VectorColor */}
            <div
              css={`
                position: absolute;
                top: 12px;
                left: 12px;
                display: inline-block;
                width: 20px;
                height: 20px;
                /* border-radius: 100px; */
                border: 4px solid;
                vertical-align: middle;
                box-shadow: 0 0 0 2px #dbdbdb, 0 0 2px 1px rgba(0, 0, 0, 0.4);
              `}
              style={{ borderColor: rgba(color.r, color.g, color.b, 1) }}
              // onClick={handleClickColor}
            />
            <div
              css={`
                position: absolute;
                top: 0;
                left: 0;
                z-index: 1;
                display: inline-block;
                width: 20px;
                height: 20px;
                /* border-radius: 100px; */
                border: 1px solid #dbdbdb;
                vertical-align: middle;
                box-shadow: 0 0 2px 1px rgba(0, 0, 0, 0.4);
              `}
              style={{ backgroundColor: rgba(color.r, color.g, color.b, 1) }}
              // onClick={handleClickColor}
            />
          </div>
        )}
      </div>

      <div
        css={`
          display: flex;
          gap: 0;
          border-radius: 100px;
          border: 1px solid ${rgba('#000', 0.3)};
          overflow: hidden;

          div:first-of-type {
            padding-left: 8px;
          }

          div:last-of-type {
            padding-right: 8px;
          }
        `}
      >
        <div
          css="padding:4px; border-radius: 60px 0 0 60px; transition: background-color .2s ease-in-out;"
          style={{
            backgroundColor:
              editorState.currentTool === 'cursor'
                ? theme.surface.brushViewActive
                : 'transparent',
          }}
          onClick={handleChangeToCursorMode}
        >
          <Cursor css="width:26px; vertical-align:bottom;" />
        </div>

        {layerControls.activeLayer?.layerType === 'vector' && (
          <div
            css="padding:4px; border-radius: 0; transition: background-color .2s ease-in-out;"
            style={{
              backgroundColor:
                editorState.currentTool === 'shape-pen'
                  ? theme.surface.brushViewActive
                  : 'transparent',
            }}
            onClick={handleChangeToShapePenMode}
          >
            {/* <Shape css="width:26px; vertical-align:bottom;" /> */}
            <Pencil css="width:24px;" />
          </div>
        )}

        <div
          ref={brushRef}
          css="padding:4px; border-radius: 0; transition: background-color .2s ease-in-out;"
          style={{
            backgroundColor:
              editorState.currentTool === 'draw'
                ? theme.surface.brushViewActive
                : 'transparent',
          }}
          onClick={handleChangeToPencilMode}
        >
          <Brush css="width:26px; vertical-align:bottom;" />
        </div>

        {layerControls.activeLayer?.layerType === 'raster' && (
          <div
            css="padding: 4px; border-radius: 0 60px 60px 0; transition: background-color .2s ease-in-out;"
            style={{
              backgroundColor:
                editorState.currentTool === 'erase'
                  ? theme.surface.brushViewActive
                  : 'transparent',
            }}
            onClick={handleChangeToEraceMode}
          >
            <Eraser css="width:26px; vertical-align:bottom;" />
          </div>
        )}

        <Portal>
          <div
            ref={brushPopRef}
            css={`
              margin-left: -16px;
              margin-bottom: 16px;
              background-color: ${({ theme }) => theme.surface.floatWhite};
              border-radius: 4px;

              &::before {
                content: '';
                display: inline-block;
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 6px solid;
                border-color: ${({ theme }) => theme.surface.floatWhite}
                  transparent transparent transparent;
              }
            `}
            data-todo-brush-selector
            style={{
              ...brushPopper.styles.popper,
              ...(openBrush
                ? { opacity: 1, pointerEvents: 'all' }
                : { opacity: 0, pointerEvents: 'none' }),
            }}
          >
            <ul>
              <BrushItem
                name="普通筆"
                id="Brush"
                onSelect={handleChangeBrush}
              />
              <BrushItem
                name="テスト筆"
                id="ExampleBrush"
                onSelect={handleChangeBrush}
              />
            </ul>
          </div>
        </Portal>
      </div>

      {/* {isNarrowMedia && ( */}
      <div
        ref={layerRef}
        css={`
          position: relative;
          padding: 4px;
          border-radius: 60px;
          transition: background-color 0.2s ease-in-out;
        `}
        style={{
          backgroundColor: openLayers
            ? theme.surface.brushViewActive
            : 'transparent',
        }}
        onClick={handleClickLayerIcon}
      >
        {openLayers ? (
          <Close css="width: 26px;" />
        ) : (
          <Stack css="width: 26px;" />
        )}

        <FloatMenu
          ref={layerPopRef}
          css={`
            width: 300px;
          `}
          style={{
            ...layerPopper.styles.popper,
            ...(openLayers
              ? { opacity: 1, pointerEvents: 'all' }
              : { opacity: 0, pointerEvents: 'none' }),
          }}
          {...layerPopper.attributes.popper}
        >
          <LayerFloatMenu />
        </FloatMenu>
      </div>
      {/* )} */}
    </div>
  )
}

const BrushItem = ({
  name,
  id,
  onSelect,
}: {
  name: string
  id: keyof typeof SilkBrushes
  onSelect: (id: keyof typeof SilkBrushes) => void
}) => {
  const theme = useTheme()
  const engine = useSilkEngine()

  const handleClick = useCallback(() => {
    onSelect(id)
  }, [onSelect])

  return (
    <li
      css={`
        padding: 4px;
        user-select: none;
        cursor: default;
      `}
      style={{
        backgroundColor:
          engine?.currentBrush?.id === SilkBrushes[id].id
            ? theme.surface.floatActive
            : 'transparent',
      }}
      onClick={handleClick}
    >
      {name}
    </li>
  )
}
