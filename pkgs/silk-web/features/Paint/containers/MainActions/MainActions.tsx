import { MouseEvent, useEffect, useRef, useState } from 'react'
import { useFleurContext, useStore } from '@fleur/react'
import { ChromePicker, ColorChangeHandler, CustomPicker } from 'react-color'
import { Hue, Saturation } from 'react-color/lib/components/common'
import { rgba, readableColor, rgb } from 'polished'
import { usePopper } from 'react-popper'
import { SilkBrushes, SilkDOM } from 'silk-core'
import { useTranslation } from 'next-i18next'
import { useClickAway, useToggle, useUpdate } from 'react-use'
import { Brush, Close, Eraser, Pencil, Stack } from '@styled-icons/remix-line'
import { Cursor } from '@styled-icons/remix-fill'
import { useTheme } from 'styled-components'
import { Portal } from '🙌/components/Portal'
import { FloatMenu } from '🙌/components/FloatMenu'
import { LayerFloatMenu } from './LayerFloatMenu'
import { useDrag } from 'react-use-gesture'
import { DOMUtils } from '🙌/utils/dom'
import { SelectBox } from '🙌/components/SelectBox'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useFunk } from '@hanakla/arma'
import {
  autoPlacement,
  offset,
  shift,
  useFloating,
} from '@floating-ui/react-dom'

export function MainActions() {
  const theme = useTheme()
  // const isNarrowMedia = useMedia(`(max-width: ${narrow})`)

  const { executeOperation } = useFleurContext()
  const {
    currentVectorBrush,
    currentVectorFill,
    currentTool,
    brushSetting,
    activeLayer,
    activeObject,
  } = useStore((get) => ({
    currentVectorBrush: EditorSelector.currentVectorBrush(get),
    currentVectorFill: EditorSelector.currentVectorFill(get),
    currentTool: get(EditorStore).state.currentTool,
    brushSetting: EditorSelector.currentBrushSetting(get),
    activeLayer: EditorSelector.activeLayer(get),
    activeObject: EditorSelector.activeObject(get),
  }))

  const [color, setColor] = useState(
    brushSetting?.color
      ? {
          r: Math.round(brushSetting.color.r * 255),
          g: Math.round(brushSetting.color.g * 255),
          b: Math.round(brushSetting.color.b * 255),
        }
      : { r: 30, g: 30, b: 30 }
  )
  const [pickerOpened, toggleColorPicker] = useToggle(false)
  const [brushOpened, toggleBrush] = useToggle(false)
  const [layersOpened, toggleLayers] = useToggle(false)
  const [vectorColorOpened, toggleVectorColorOpened] = useToggle(false)
  const [vectorColorTarget, setVectorColorTarget] = useState<'fill' | 'stroke'>(
    'fill'
  )
  const [brushSize, setBrushSize] = useState(1)
  const [brushOpacity, setBrushOpacity] = useState(1)

  const handleChangeColor: ColorChangeHandler = useFunk((color) => {
    setColor(color.rgb)
  })

  const handleChangeCompleteColor: ColorChangeHandler = useFunk((color) => {
    setColor(color.rgb)
    executeOperation(EditorOps.setBrushSetting, {
      color: {
        r: color.rgb.r / 255,
        g: color.rgb.g / 255,
        b: color.rgb.b / 255,
      },
    })
  })

  const handleChangeToCursorMode = useFunk(() => {
    executeOperation(
      EditorOps.setTool,
      currentTool === 'cursor' && activeLayer?.layerType === 'vector'
        ? 'point-cursor'
        : 'cursor'
    )
  })

  const handleChangeToShapePenMode = useFunk(() => {
    executeOperation(EditorOps.setTool, 'shape-pen')
  })

  const handleChangeToPencilMode = useFunk(() => {
    if (currentTool === 'draw') {
      toggleBrush(true)
      return
    }

    executeOperation(EditorOps.setTool, 'draw')
  })

  const handleChangeToEraceMode = useFunk(() => {
    executeOperation(EditorOps.setTool, 'erase')
  })

  const handleChangeBrush = useFunk((id: string) => {
    executeOperation(EditorOps.setBrushSetting, { brushId: id })
  })

  const handleClickColor = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (colorPickerPopRef.current!.contains(e.target as HTMLElement)) return
    toggleColorPicker()
  })

  const handleClickLayerIcon = useFunk((e: MouseEvent<HTMLDivElement>) => {
    // if (layerPopRef.current!.contains(e.target as HTMLElement)) return
    toggleLayers()
  })

  const handleClickVectorStrokeColor = useFunk(() => {
    setVectorColorTarget('stroke')
    toggleVectorColorOpened(true)
  })

  const handleClickVectorFillColor = useFunk(() => {
    setVectorColorTarget('fill')
    toggleVectorColorOpened(true)
  })

  const brushRef = useRef<HTMLDivElement | null>(null)
  const brushPopRef = useRef<HTMLDivElement | null>(null)
  const brushPopper = usePopper(brushRef.current, brushPopRef.current, {
    strategy: 'fixed',
    placement: 'top-start',
  })

  const layerRef = useRef<HTMLDivElement | null>(null)
  const layerPopRef = useRef<HTMLDivElement | null>(null)
  const layerPopper = usePopper(layerRef.current, layerPopRef.current, {
    strategy: 'fixed',
    placement: 'top-start',
  })

  const layersArrowRef = useRef<HTMLDivElement | null>(null)
  const layersFloat = useFloating({
    strategy: 'absolute',
    placement: 'top',
    middleware: [
      // arrow({ element: layersArrowRef }),
      offset(12),
      shift({ padding: 8 }),
      autoPlacement({ alignment: 'start', allowedPlacements: ['top'] }),
    ],
  })

  const colorPickerPopRef = useRef<HTMLDivElement | null>(null)

  const vectorColorRootRef = useRef<HTMLDivElement | null>(null)
  const vectorColorPickerPopRef = useRef<HTMLDivElement | null>(null)
  const vectorColorPopper = usePopper(layerRef.current, layerPopRef.current, {
    strategy: 'fixed' ?? '',
    placement: 'top-start',
  })

  // useEffect(() => {
  //   layersFloat.update()
  // })

  useClickAway(colorPickerPopRef, (e) => {
    if (DOMUtils.childrenOrSelf(e.target, colorPickerPopRef.current)) return
    if (pickerOpened) toggleColorPicker(false)
  })
  useClickAway(vectorColorPickerPopRef, (e) => {
    if (DOMUtils.childrenOrSelf(e.target, vectorColorPickerPopRef.current))
      return
    if (vectorColorOpened) toggleVectorColorOpened(false)
  })
  useClickAway(brushPopRef, (e) => {
    if (DOMUtils.childrenOrSelf(e.target, brushRef.current)) return
    if (brushOpened) toggleBrush(false)
  })
  useClickAway(layerPopRef, (e) => {
    if (DOMUtils.childrenOrSelf(e.target, layerRef.current)) return
    if (layersOpened) toggleLayers(false)
  })
  // useClickAway(vectorColorPickerPopRef, () => toggleVectorColorOpened(false))

  const bindBrushSizeDrag = useDrag(({ delta, first, last, event }) => {
    if (first) {
      ;(event.currentTarget as HTMLDivElement).requestPointerLock?.()
    }

    if (last) {
      document.exitPointerLock?.()
    }

    const changed = delta[0] * 0.2
    setBrushSize((size) => {
      const next = Math.max(0, size + changed)
      executeOperation(EditorOps.setBrushSetting, { size: next })
      return next
    })
  })

  const bindBrushOpacityDrag = useDrag(({ delta, first, last, event }) => {
    if (first) {
      ;(event.currentTarget as HTMLDivElement).requestPointerLock?.()
    }

    if (last) {
      document.exitPointerLock?.()
    }

    const changed = delta[0] * 0.003
    setBrushOpacity((opacity) => {
      const next = Math.min(Math.max(0, opacity + changed), 1)
      executeOperation(EditorOps.setBrushSetting, { opacity: next })
      return next
    })
  })

  return (
    <div
      css={`
        display: flex;
        gap: 8px;
        padding: 8px 16px;
        margin-bottom: env(safe-area-inset-bottom);
        background-color: ${({ theme }) => theme.exactColors.whiteFade50};
        border-radius: 100px;
        color: ${({ theme }) => theme.exactColors.black40};
        border: 1px solid #aaa;
        white-space: nowrap;
        touch-action: manipulation;
      `}
    >
      <div
        css={`
          display: flex;
          gap: 4px;
        `}
      >
        <div
          css={`
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border: 1px solid #000;
            border-radius: 64px;
          `}
          {...bindBrushSizeDrag()}
        >
          {(Math.round(brushSize * 10) / 10).toString(10)}
        </div>
        <div
          css={`
            width: 36px;
            height: 36px;
            border: 1px solid #000;
            border-radius: 64px;
            overflow: hidden;

            background: linear-gradient(
                45deg,
                rgba(0, 0, 0, 0.2) 25%,
                transparent 25%,
                transparent 75%,
                rgba(0, 0, 0, 0.2) 75%
              ),
              linear-gradient(
                45deg,
                rgba(0, 0, 0, 0.2) 25%,
                transparent 25%,
                transparent 75%,
                rgba(0, 0, 0, 0.2) 75%
              );
            background-size: 4px 4px;
            background-position: 0 0, 2px 2px; ;
          `}
          {...bindBrushOpacityDrag()}
        >
          <div
            css={`
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              height: 100%;
            `}
            style={{
              backgroundColor: rgba(color.r, color.g, color.b, brushOpacity),
              color: readableColor(
                rgb(color.r, color.g, color.b),
                '#222',
                '#eee'
              ),
            }}
          >
            {Math.round(brushOpacity * 100)}
            <span css="font-size: .8em">%</span>
          </div>
        </div>
      </div>

      <div
        css={`
          width: 36px;
          height: 36px;
        `}
      >
        {activeLayer?.layerType === 'raster' ? (
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
              ref={colorPickerPopRef}
              style={{
                ...(pickerOpened
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
            ref={vectorColorRootRef}
            css={`
              position: relative;
              width: 36px;
              height: 36px;
            `}
          >
            {/* VectorColor */}
            <div
              // Stroke color
              css={`
                position: absolute;
                top: 12px;
                left: 12px;
                display: inline-block;
                width: 20px;
                height: 20px;
                /* border-radius: 100px; */
                border: 4px solid transparent;
                vertical-align: middle;
                box-shadow: 0 0 0 2px #dbdbdb, 0 0 2px 1px rgba(0, 0, 0, 0.4);
              `}
              style={{
                zIndex: vectorColorTarget === 'stroke' ? 1 : 0,
                borderColor: currentVectorBrush
                  ? rgba(
                      currentVectorBrush.color.r,
                      currentVectorBrush.color.g,
                      currentVectorBrush.color.b,
                      currentVectorBrush.opacity
                    )
                  : undefined,
              }}
              onClick={handleClickVectorStrokeColor}
            />
            <div
              // Fill color
              css={`
                position: absolute;
                top: 2px;
                left: 2px;
                z-index: 1;
                display: inline-block;
                width: 20px;
                height: 20px;
                /* border-radius: 100px; */
                border: 1px solid #dbdbdb;
                vertical-align: middle;
                box-shadow: 0 0 2px 1px rgba(0, 0, 0, 0.4);
              `}
              style={{
                zIndex: vectorColorTarget === 'fill' ? 1 : 0,
                // prettier-ignore
                background:
                  currentVectorFill?.type ==='fill' ? rgba(currentVectorFill.color.r, currentVectorFill.color.g, currentVectorFill.color.b, currentVectorFill.opacity)  :
                  currentVectorFill?.type === 'linear-gradient' ?
                    `linear-gradient(45deg, ${
                      currentVectorFill.colorPoints.map(({color, position}) => `${rgba(color.r, color.g, color.b, color.a)} ${position * 100}%`).join(', ')
                    })` :
                  undefined,
              }}
              onClick={handleClickVectorFillColor}
            />
            <div
              ref={vectorColorPickerPopRef}
              style={{
                ...(vectorColorOpened
                  ? { opacity: 1, pointerEvents: 'all' }
                  : { opacity: 0, pointerEvents: 'none' }),
                ...vectorColorPopper.styles.popper,
              }}
              data-ignore-click
              {...vectorColorPopper.attributes.popper}
            >
              {activeObject && (
                <VectorColorPicker
                  mode={vectorColorTarget}
                  object={activeObject}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <div
        css={`
          display: flex;
          height: 36px;
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
              currentTool === 'cursor'
                ? theme.exactColors.blackFade30
                : 'transparent',
          }}
          onClick={handleChangeToCursorMode}
        >
          <Cursor css="width:24px; vertical-align:bottom;" />
        </div>

        {activeLayer?.layerType === 'vector' && (
          <div
            css="padding:4px; border-radius: 0; transition: background-color .2s ease-in-out;"
            style={{
              backgroundColor:
                currentTool === 'shape-pen'
                  ? theme.exactColors.blackFade30
                  : 'transparent',
            }}
            onClick={handleChangeToShapePenMode}
          >
            <Pencil css="width:24px;" />
          </div>
        )}

        <div
          ref={brushRef}
          css="padding:4px; border-radius: 0; transition: background-color .2s ease-in-out;"
          style={{
            backgroundColor:
              currentTool === 'draw'
                ? theme.exactColors.blackFade30
                : 'transparent',
          }}
          onClick={handleChangeToPencilMode}
        >
          <Brush css="width:24px; vertical-align:bottom;" />
        </div>

        {activeLayer?.layerType === 'raster' && (
          <div
            css="padding: 4px; border-radius: 0 60px 60px 0; transition: background-color .2s ease-in-out;"
            style={{
              backgroundColor:
                currentTool === 'erase'
                  ? theme.exactColors.blackFade30
                  : 'transparent',
            }}
            onClick={handleChangeToEraceMode}
          >
            <Eraser css="width:24px; vertical-align:bottom;" />
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
              ...(brushOpened
                ? { opacity: 1, pointerEvents: 'all' }
                : { opacity: 0, pointerEvents: 'none' }),
            }}
          >
            <ul>
              <BrushItem
                name="普通筆"
                brushId={SilkBrushes.Brush.id}
                active={brushSetting?.brushId === SilkBrushes.Brush.id}
                onSelect={handleChangeBrush}
              />
              <BrushItem
                name="スキャッター"
                brushId={SilkBrushes.ScatterBrush.id}
                active={brushSetting?.brushId === SilkBrushes.ScatterBrush.id}
                onSelect={handleChangeBrush}
              />
              <BrushItem
                name="テスト筆"
                brushId={SilkBrushes.ExampleBrush.id}
                active={brushSetting?.brushId === SilkBrushes.ExampleBrush.id}
                onSelect={handleChangeBrush}
              />
            </ul>
          </div>
        </Portal>
      </div>

      {/* {isNarrowMedia && ( */}
      <div
        ref={layersFloat.reference}
        css={`
          position: relative;
          padding: 4px;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 36px;
          border-radius: 60px;
          transition: background-color 0.2s ease-in-out;
        `}
        style={{
          backgroundColor: layersOpened ? theme.exactColors.blackFade30 : '',
        }}
        onClick={handleClickLayerIcon}
      >
        <>
          {layersOpened ? (
            <Close css="width: 26px;" />
          ) : (
            <Stack css="width: 26px;" />
          )}
        </>

        <FloatMenu
          ref={layersFloat.floating}
          css={`
            width: 300px;
          `}
          style={{
            ...(layersOpened
              ? { opacity: 1, pointerEvents: 'all' }
              : { opacity: 0, pointerEvents: 'none' }),
            position: layersFloat.strategy,
            top: layersFloat.y ?? '',
            left: layersFloat.x ?? '',
          }}
        >
          <LayerFloatMenu />
          <div
            ref={layersArrowRef}
            css={`
              display: inline-block;
              position: absolute;
              /* top: 100%;
             left: 50%;
             transform: translateX(-50%); */
              border: 6px solid;
              border-color: ${({ theme }) => theme.surface.floatWhite}
                transparent transparent transparent;
            `}
            style={{
              position: 'absolute',
              top: layersFloat.middlewareData.arrow?.y ?? 0,
              left: layersFloat.middlewareData.arrow?.x ?? 0,
            }}
          />
        </FloatMenu>
      </div>
      {/* )} */}
    </div>
  )
}

const BrushItem = ({
  name,
  brushId,
  active,
  onSelect,
}: {
  name: string
  brushId: string
  active: boolean
  onSelect: (id: string) => void
}) => {
  const theme = useTheme()

  const handleClick = useFunk(() => {
    onSelect(brushId)
  })

  return (
    <li
      css={`
        padding: 4px;
        user-select: none;
        cursor: default;
      `}
      style={{
        backgroundColor: active ? theme.exactColors.blueFade50 : 'transparent',
      }}
      onClick={handleClick}
    >
      {name}
    </li>
  )
}

const VectorColorPicker = ({
  object,
  mode,
}: // color,
// onChange,
// onChangeComplete,

{
  object: SilkDOM.VectorObject
  mode: 'fill' | 'stroke'
  // color: Color
  // onChange: ColorChangeHandler
  // onChangeComplete: ColorChangeHandler
}) => {
  const { t } = useTranslation('app')

  const { executeOperation } = useFleurContext()
  const { currentVectorBrush, defaultVectorBrush } = useStore((get) => ({
    currentVectorBrush: EditorSelector.currentVectorBrush(get),
    defaultVectorBrush: EditorSelector.defaultVectorBrush(get),
  }))

  const handleChangeFillMode = useFunk(() => {
    // handleChangeFillMode
  })

  const handleChangeStrokeColor: ColorChangeHandler = useFunk(
    ({ rgb: { r, g, b } }) => {
      executeOperation(EditorOps.updateActiveObject, (obj) => {
        obj.brush = obj.brush
          ? { ...obj.brush, color: { r, g, b } }
          : {
              ...(currentVectorBrush ?? defaultVectorBrush),
              color: { r, g, b },
            }
      })
    }
  )

  return (
    <div>
      {mode === 'fill' && (
        <>
          <div>
            <SelectBox
              items={[
                { label: t('vectorColorPicker.modes.solid'), value: 'solid' },
                {
                  label: t('vectorColorPicker.modes.linearGradient'),
                  value: 'linear-gradient',
                },
              ]}
              value={object.fill?.type}
              placeholder={t('vectorColorPicker.noFill')}
              placement="auto"
              onChange={handleChangeFillMode}
            />
          </div>
          <div
            css={`
              position: relative;
              height: 100px;
            `}
          >
            <CustomColorPicker color={{ r: 0, g: 0, b: 0 }} />
          </div>
        </>
      )}
      {mode === 'stroke' && object.brush && (
        <ChromePicker
          css={`
            /* position: absolute;
    left: 50%;
    bottom: 100%;
    transform: translateX(-50%); */
          `}
          color={object.brush?.color}
          onChange={handleChangeStrokeColor}
          onChangeComplete={handleChangeStrokeColor}
        />
      )}
    </div>
  )
}

const CustomColorPicker = CustomPicker((props) => {
  return (
    <div>
      <Hue {...props} />
      <Saturation {...props} />
    </div>
  )
})
