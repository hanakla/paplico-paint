import { MouseEvent, useRef, useState } from 'react'
import { useFleurContext, useStore } from '@fleur/react'
import { ChromePicker, ColorChangeHandler, CustomPicker } from 'react-color'
import { Hue, Saturation } from 'react-color/lib/components/common'
import { rgba, readableColor, rgb } from 'polished'
import { usePopper } from 'react-popper'
import { SilkBrushes, SilkEntity } from 'silk-core'
import { useTranslation } from 'next-i18next'
import { useClickAway, useMedia, useToggle, useUpdate } from 'react-use'
import { Brush, Close, Eraser, Pencil, Stack } from '@styled-icons/remix-line'
import { Cursor } from '@styled-icons/remix-fill'
import { css, useTheme } from 'styled-components'
import { Portal } from '🙌/components/Portal'
import { narrow } from '🙌/utils/responsive'
import { FloatMenu } from '🙌/components/FloatMenu'
import { LayerFloatMenu } from './LayerFloatMenu'
import { useDrag } from 'react-use-gesture'
import { DOMUtils } from '🙌/utils/dom'
import { SelectBox } from '🙌/components/SelectBox'
import { editorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { useFunk } from '@hanakla/arma'
import { isEventIgnoringTarget } from '../../helpers'

export function MainActions() {
  const theme = useTheme()
  // const isNarrowMedia = useMedia(`(max-width: ${narrow})`)

  const { executeOperation } = useFleurContext()
  const {
    currentVectorBrush,
    currentVectorFill,
    currentTool,
    activeLayer,
    activeObject,
  } = useStore((get) => ({
    currentVectorBrush: EditorSelector.currentVectorBrush(get),
    currentVectorFill: EditorSelector.currentVectorFill(get),
    currentTool: get(EditorStore).state.currentTool,
    activeLayer: EditorSelector.activeLayer(get),
    activeObject: EditorSelector.activeObject(get),
  }))

  const [color, setColor] = useState({ r: 0, g: 0, b: 0 })
  const [openPicker, togglePicker] = useToggle(false)
  const [openBrush, toggleBrush] = useToggle(false)
  const [openLayers, toggleLayers] = useToggle(false)
  const [vectorColorOpened, toggleVectorColorOpened] = useToggle(false)
  const [vectorColorTarget, setVectorColorTarget] = useState<'fill' | 'stroke'>(
    'fill'
  )
  const [weight, setWeight] = useState(1)
  const [brushOpacity, setBrushOpacity] = useState(1)
  const rerender = useUpdate()

  const handleChangeColor: ColorChangeHandler = useFunk((color) => {
    setColor(color.rgb)
  })

  const handleChangeCompleteColor: ColorChangeHandler = useFunk((color) => {
    setColor(color.rgb)
    executeOperation(editorOps.setBrushSetting, { color })
  })

  const handleChangeToCursorMode = useFunk(() => {
    executeOperation(editorOps.setTool, 'cursor')
  })

  const handleChangeToShapePenMode = useFunk(() => {
    executeOperation(editorOps.setTool, 'shape-pen')
  })

  const handleChangeToPencilMode = useFunk(() => {
    if (currentTool === 'draw') {
      toggleBrush(true)
      return
    }

    executeOperation(editorOps.setTool, 'draw')
  })

  const handleChangeToEraceMode = useFunk(() => {
    executeOperation(editorOps.setTool, 'erase')
  })

  const handleChangeBrush = useFunk((id: keyof typeof SilkBrushes) => {
    // if (!engine) return
    // engine.setBrush(SilkBrushes[id])
    // rerender()
  })

  const handleClickColor = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (colorPickerPopRef.current!.contains(e.target as HTMLElement)) return
    togglePicker()
  })

  const handleClickLayerIcon = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (layerPopRef.current!.contains(e.target as HTMLElement)) return
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

  const colorPickerPopRef = useRef<HTMLDivElement | null>(null)

  const vectorColorRootRef = useRef<HTMLDivElement | null>(null)
  const vectorColorPickerPopRef = useRef<HTMLDivElement | null>(null)
  const vectorColorPopper = usePopper(layerRef.current, layerPopRef.current, {
    strategy: 'fixed' ?? '',
    placement: 'top-start',
  })

  // useEffect(() => {
  //   layerPopper.forceUpdate?.()
  // })

  useClickAway(colorPickerPopRef, (e) => {
    if (isEventIgnoringTarget(e.target)) return
    togglePicker(false)
  })
  useClickAway(vectorColorPickerPopRef, (e) => {
    if (isEventIgnoringTarget(e.target)) return
    toggleVectorColorOpened(false)
  })
  useClickAway(brushPopRef, (e) => {
    if (isEventIgnoringTarget(e.target)) return
    if (DOMUtils.childrenOrSelf(e.target, brushRef.current)) return
    toggleBrush(false)
  })
  useClickAway(layerPopRef, (e) => {
    if (isEventIgnoringTarget(e.target)) return
    if (DOMUtils.childrenOrSelf(e.target, layerRef.current)) return

    toggleLayers(false)
  })
  // useClickAway(vectorColorPickerPopRef, () => toggleVectorColorOpened(false))

  const bindWeightDrag = useDrag(({ delta, first, last, event }) => {
    if (first) {
      ;(event.currentTarget as HTMLDivElement).requestPointerLock?.()
    }

    if (last) {
      document.exitPointerLock?.()
    }

    const changed = delta[0] * 0.2
    setWeight((weight) => {
      const next = Math.max(0, weight + changed)
      executeOperation(editorOps.setBrushSetting, { weight: next })
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
      executeOperation(editorOps.setBrushSetting, { opacity: next })
      return next
    })
  })

  return (
    <div
      css={css`
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
          {...bindWeightDrag()}
        >
          {(Math.round(weight * 10) / 10).toString(10)}
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
            css={css`
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
        <>
          {openLayers ? (
            <Close css="width: 26px;" />
          ) : (
            <Stack css="width: 26px;" />
          )}
        </>

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
  const { currentBrush } = useStore((get) => ({
    currentBrush: EditorSelector.currentBrush(get),
  }))

  const handleClick = useFunk(() => {
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
          currentBrush?.id === SilkBrushes[id].id
            ? theme.exactColors.blueFade50
            : 'transparent',
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
  object: SilkEntity.VectorObject
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
    handleChangeFillMode
  })

  const handleChangeStrokeColor: ColorChangeHandler = useFunk(
    ({ rgb: { r, g, b } }) => {
      executeOperation(editorOps.updateActiveObject, (obj) => {
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
