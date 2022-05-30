import {
  ChangeEvent,
  KeyboardEvent,
  memo,
  MouseEvent,
  MutableRefObject,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useStore } from '@fleur/react'
import {
  ChromePicker,
  Color,
  ColorChangeHandler,
  CustomPicker,
  RGBColor,
} from 'react-color'
import { Alpha, Hue, Saturation } from 'react-color/lib/components/common'
import {
  rgba,
  readableColor,
  rgb,
  parseToRgb,
  rgbToColorString,
} from 'polished'
import { PapCommands, PapValueTypes } from '@paplico/core'
import { useTranslation } from 'next-i18next'
import { useClickAway, useToggle } from 'react-use'
import {
  Brush,
  Close,
  Eraser,
  Pencil,
  Stack,
  Sip,
} from '@styled-icons/remix-line'
import { Cursor, Menu } from '@styled-icons/remix-fill'
import { Cursor as CursorLine } from '@styled-icons/remix-line'
import styled, { css, useTheme } from 'styled-components'
import { Portal } from '🙌/components/Portal'
import { FloatMenu, FloatMenuArrow } from '🙌/components/FloatMenu'
import { LayerFloatMenu } from './LayerFloatMenu'
import { useDrag } from 'react-use-gesture'
import { DOMUtils } from '🙌/utils/dom'
import { pick } from '🙌/utils/object'
import { EditorOps, EditorSelector, EditorStore } from '🙌/domains/EditorStable'
import { letDownload, useFunk } from '@hanakla/arma'

import {
  arrow,
  autoPlacement,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from '@floating-ui/react-dom'
import { Tab, TabBar } from '🙌/components/TabBar'
import {
  useAutoUpdateFloating,
  useBufferedState,
  useDelayedLeave,
  useFleur,
} from '🙌/utils/hooks'
import {
  colorStopsToCssGradient,
  normalRGBAToRGBA,
  normalRgbToRgbArray,
} from '../../helpers'
import { GradientSlider } from '🙌/components/GradientSlider'
import { tm } from '🙌/utils/theme'
import { deepClone } from '🙌/utils/clone'
import { PapWebMath } from '🙌/utils/PapWebMath'
import { media } from '🙌/utils/responsive'
import { centering, checkerBoard } from '🙌/utils/mixins'
import {
  ActionSheet,
  ActionSheetItem,
  ActionSheetItemGroup,
} from '🙌/components/ActionSheet'
import { exportProject } from '🙌/domains/EditorStable/exportProject'
import { NotifyOps } from '🙌/domains/Notify'
import { RangeInput } from '🙌/components/RangeInput'
import { useTransactionCommand, useVectorObjectWatch } from '../../hooks'
import { Tooltip2 } from '🙌/components/Tooltip2'
import { the } from '🙌/utils/anyOf'
import { BrushPresets } from '../BrushPresets'
import { DragDots } from '🙌/components/icons/DragDots'
import { TextInput } from '../../../../components/TextInput'

export const MainActions = memo(function MainActions() {
  const theme = useTheme()
  // const isNarrowMedia = useMedia(`(max-width: ${narrow})`)

  const { execute } = useFleur()
  const {
    displayingBrushSetting,
    currentVectorBrush,
    currentVectorFill,
    currentTool,
    activeLayer,
    vectorColorTarget,
  } = useStore((get) => ({
    displayingBrushSetting: EditorSelector.displayingBrushSetting(get),
    currentVectorBrush: EditorSelector.currentVectorBrush(get),
    currentVectorFill: EditorSelector.currentVectorFill(get),
    currentTool: get(EditorStore).state.currentTool,
    activeLayer: EditorSelector.activeLayer(get),
    vectorColorTarget: EditorSelector.vectorColorTarget(get),
  }))

  const [color, setColor] = useBufferedState(
    displayingBrushSetting?.color
      ? {
          r: Math.round(displayingBrushSetting.color.r * 255),
          g: Math.round(displayingBrushSetting.color.g * 255),
          b: Math.round(displayingBrushSetting.color.b * 255),
        }
      : { r: 30, g: 30, b: 30 }
  )
  const [appMenuOpened, toggleAppMenuOpened] = useToggle(false)
  const [pickerOpened, toggleBrushColorPicker] = useToggle(false)
  const [brushOpened, toggleBrush] = useToggle(false)
  const [layersOpened, toggleLayers] = useToggle(false)
  const [vectorColorOpened, toggleVectorColorOpened] = useToggle(false)

  const [brushSize, setBrushSize] = useBufferedState(
    displayingBrushSetting?.size ?? 20
  )
  const [brushOpacity, setBrushOpacity] = useBufferedState(
    displayingBrushSetting?.opacity ?? 1
  )

  const handleCloseAppMenu = useFunk(() => {
    toggleAppMenuOpened(false)
  })

  const handleChangeColor: ColorChangeHandler = useFunk((color) => {
    setColor(color.rgb)
  })

  const handleChangeCompleteColor: ColorChangeHandler = useFunk((color) => {
    setColor(color.rgb)
    execute(EditorOps.setBrushSetting, {
      color: {
        r: color.rgb.r / 255,
        g: color.rgb.g / 255,
        b: color.rgb.b / 255,
      },
    })
  })

  const handleChangeToCursorMode = useFunk(() => {
    execute(
      EditorOps.setTool,
      currentTool === 'cursor' && activeLayer?.layerType === 'vector'
        ? 'point-cursor'
        : 'cursor'
    )
  })

  const handleChangeToShapePenMode = useFunk(() => {
    execute(EditorOps.setTool, 'shape-pen')
  })

  const handleChangeToPencilMode = useFunk(() => {
    if (currentTool === 'draw') {
      brushesFl.update()
      toggleBrush(true)
      return
    }

    execute(EditorOps.setTool, 'draw')
  })

  const handleChangeToDropperMode = useFunk(() => {
    execute(EditorOps.setTool, 'dropper')
  })

  const handleChangeToEraceMode = useFunk(() => {
    execute(EditorOps.setTool, 'erase')
  })

  const handleClickColor = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (
      DOMUtils.isChildren(
        e.target,
        colorPickerFl.refs.reference.current as Element
      )
    )
      return

    toggleBrushColorPicker()
  })

  const handleClickLayerIcon = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (
      DOMUtils.closestOrSelf(
        e.target,
        '[data-ignore-click],[data-dont-close-layer-float]'
      )
    )
      return
    layersFl.update()
    toggleLayers()
  })

  const handleClickVectorStrokeColor = useFunk(
    (e: MouseEvent<HTMLDivElement>) => {
      if (DOMUtils.isChildren(e.target, e.currentTarget)) return

      if (!vectorColorOpened) {
        execute(EditorOps.setVectorColorTarget, 'stroke')
      }

      toggleVectorColorOpened()
    }
  )

  const handleClickVectorFillColor = useFunk(
    (e: MouseEvent<HTMLDivElement>) => {
      if (DOMUtils.isChildren(e.target, e.currentTarget)) return

      if (!vectorColorOpened) {
        execute(EditorOps.setVectorColorTarget, 'fill')
      }

      toggleVectorColorOpened()
    }
  )

  const handleCloseVectorColorPicker = useFunk(() => {
    toggleVectorColorOpened(false)
  })

  const appMenuOpenerRef = useRef<HTMLDivElement | null>(null)

  const brushesArrowRef = useRef<HTMLDivElement | null>(null)
  const brushesFl = useFloating({
    placement: 'top',
    strategy: 'fixed',
    middleware: [
      offset(12),
      shift({ padding: 8 }),
      flip(),
      arrow({ element: brushesArrowRef }),
    ],
  })

  const colorPickerArrowRef = useRef<HTMLDivElement | null>(null)
  const colorPickerFl = useFloating({
    placement: 'top',
    strategy: 'absolute',
    middleware: [
      offset(12),
      shift({ padding: 8 }),
      flip(),
      arrow({ element: colorPickerArrowRef }),
    ],
  })

  const layersArrowRef = useRef<HTMLDivElement | null>(null)
  const layersFl = useFloating({
    strategy: 'absolute',
    placement: 'top',
    middleware: [
      offset(12),
      shift({ padding: 8 }),
      flip(),
      // autoPlacement({ alignment: 'start', allowedPlacements: ['top'] }),
      arrow({ element: layersArrowRef }),
    ],
  })

  const vectorColorRootRef = useRef<HTMLDivElement | null>(null)

  useAutoUpdateFloating(brushesFl)
  useAutoUpdateFloating(colorPickerFl)
  useAutoUpdateFloating(layersFl)

  useClickAway(appMenuOpenerRef, (e) => {
    if (DOMUtils.isChildren(e.target, e.currentTarget)) return
    toggleAppMenuOpened(false)
  })

  useClickAway(colorPickerFl.refs.floating, (e) => {
    if (
      DOMUtils.childrenOrSelf(
        e.target,
        colorPickerFl.refs.reference.current as HTMLElement | null
      )
    )
      return

    if (pickerOpened) toggleBrushColorPicker(false)
  })

  useClickAway(brushesFl.refs.floating, (e) => {
    if (
      DOMUtils.childrenOrSelf(
        e.target,
        brushesFl.refs.reference.current as HTMLElement | null
      )
    )
      return
    if (brushOpened) toggleBrush(false)
  })

  useClickAway(
    layersFl.refs.reference as MutableRefObject<HTMLElement>,
    (e) => {
      if (DOMUtils.closestOrSelf(e.target, '[data-dont-close-layer-float]'))
        return

      toggleLayers(false)
    }
  )

  useDelayedLeave(colorPickerFl.refs.floating, 1300, () => {
    toggleBrushColorPicker(false)
  })

  // useDelayedLeave(vectorColorRootRef, 2000, () => {
  //   toggleVectorFillColorOpened(false)
  // })

  const bindBrushSizeDrag = useDrag(({ delta, first, last, event }) => {
    if (first) {
      execute(EditorOps.setBrushSizeChanging, true)
      ;(event.currentTarget as HTMLDivElement).requestPointerLock?.()
    }

    if (last) {
      execute(EditorOps.setBrushSizeChanging, false)
      document.exitPointerLock?.()
    }

    const changed = delta[0] < 0 ? delta[0] * 1.2 : delta[0] * 0.4

    setBrushSize((size) => {
      const next = Math.max(0, size + changed)
      execute(EditorOps.setBrushSetting, { size: next })
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
      execute(EditorOps.setBrushSetting, { opacity: next })
      return next
    })
  })

  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })

  const bindMenuPosDrag = useDrag(
    ({ delta }) => {
      setMenuPos((pos) => ({ x: pos.x + delta[0], y: pos.y + delta[1] }))
      brushesFl.update()
      colorPickerFl.update()
      layersFl.update()
    },
    {
      threshold: 2,
    }
  )

  return (
    <div
      css={css`
        display: flex;
        gap: 8px;
        padding: 8px 16px;
        /* margin-bottom: env(safe-area-inset-bottom); */
        background-color: ${({ theme }) => theme.color.surface3};
        border-radius: 100px;
        color: ${({ theme }) => theme.color.text1};
        border: 1px solid ${({ theme }) => theme.color.surface7};
        white-space: nowrap;
        touch-action: manipulation;

        ${media.narrow`
          border: none;
          border-top: 1px solid #aaa;
          border-radius: 0;
          padding-bottom: 24px;
          padding-bottom: max(env(safe-area-inset-bottom, 24px), 24px);
        `}
      `}
      style={{
        transform: `translate(${menuPos.x}px, ${menuPos.y}px)`,
      }}
      data-ignore-canvas-wheel
    >
      <DragDots
        css={`
          margin-right: -8px;

          ${media.narrow`
            display: none;
          `}
        `}
        width={24}
        fillOpacity={0.5}
        {...bindMenuPosDrag()}
      />
      <div
        css={`
          display: flex;
          gap: 4px;
        `}
      >
        <div
          ref={appMenuOpenerRef}
          css={`
            ${centering()}
            width: 36px;
            height: 36px;
          `}
        >
          <Menu width={24} onClick={toggleAppMenuOpened} />

          <AppMenu opened={appMenuOpened} onClose={handleCloseAppMenu} />
        </div>

        <div
          css={css`
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border: 1px solid;
            border-color: ${({ theme }) => theme.color.surface8};
            border-radius: 64px;
            overflow: hidden;
          `}
          {...bindBrushSizeDrag()}
        >
          <div
            css={`
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background-color: #000;

              border-radius: 100px;
            `}
            style={{ width: brushSize, height: brushSize }}
          />
          <div
            css={`
              color: #fff;
              mix-blend-mode: difference;
            `}
          >
            {(Math.round(brushSize * 10) / 10).toString(10)}
          </div>
        </div>
        <div
          css={css`
            width: 36px;
            height: 36px;
            border: 1px solid;
            border-color: ${({ theme }) => theme.color.surface8};
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
            ref={colorPickerFl.reference}
            css={`
              position: relative;
              display: inline-block;
              width: 36px;
              height: 36px;
              border: 2px solid #dbdbdb;
              vertical-align: middle;
              /* box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.4); */
            `}
            style={{ backgroundColor: rgba(color.r, color.g, color.b, 1) }}
            onClick={handleClickColor}
          >
            <div data-ignore-click>
              <FloatMenu
                ref={colorPickerFl.floating}
                style={{
                  position: colorPickerFl.strategy,
                  left: colorPickerFl.x ?? 0,
                  top: colorPickerFl.y ?? 0,
                  ...(pickerOpened
                    ? { opacity: 1, pointerEvents: 'all' }
                    : { opacity: 0, pointerEvents: 'none' }),
                }}
              >
                <BrushColorPicker
                  color={color}
                  onChange={handleChangeColor}
                  onChangeComplete={handleChangeCompleteColor}
                  disableAlpha
                />

                <FloatMenuArrow
                  ref={colorPickerArrowRef}
                  style={{
                    left: colorPickerFl.middlewareData.arrow?.x ?? 0,
                    // top: colorPickerFl.middlewareData.arrow?.y ?? 0,
                  }}
                />
              </FloatMenu>
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
                border: 3px solid transparent;
                vertical-align: middle;
                // prettier-ignore
                box-shadow:
                  inset 0 0 0 1px #eee,
                  inset 0 0 0 2px #333,
                  0 0 0 1px #eee,
                  0 0 0 2px #333;
              `}
              style={{
                zIndex: vectorColorTarget === 'stroke' ? 1 : 0,
                borderColor: currentVectorBrush
                  ? rgba(
                      ...normalRgbToRgbArray(currentVectorBrush.color),
                      currentVectorBrush.opacity
                    )
                  : undefined,
              }}
              onClick={handleClickVectorStrokeColor}
            >
              {!currentVectorBrush && <NoColorSlash />}
            </div>

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
                border: 1px solid #333;
                vertical-align: middle;
                box-shadow: inset 0 0 0 1px #eee;
              `}
              style={{
                zIndex: vectorColorTarget === 'fill' ? 1 : 0,
                // prettier-ignore
                background:
                  currentVectorFill?.type === 'fill'
                    ? rgba(
                        ...normalRgbToRgbArray(currentVectorFill.color),
                        currentVectorFill.opacity
                      )
                    : currentVectorFill?.type === 'linear-gradient'
                    ? colorStopsToCssGradient(
                        PapWebMath.radToDeg(PapWebMath.angleOfPoints(
                          currentVectorFill.start,
                          currentVectorFill.end
                        )),
                        currentVectorFill.colorStops
                      )
                    : undefined,
              }}
              onClick={handleClickVectorFillColor}
            >
              {!currentVectorFill && <NoColorSlash />}
            </div>

            <VectorColorPicker
              opened={vectorColorOpened}
              target={vectorColorTarget}
              onClose={handleCloseVectorColorPicker}
            />
          </div>
        )}
      </div>

      <div
        css={css`
          display: flex;
          height: 36px;
          gap: 0;
          border-radius: 100px;
          border: 1px solid ${({ theme }) => theme.color.surface7};
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
          css={`
            ${centering()}
            padding: 4px;
            border-radius: 60px 0 0 60px;
            transition: background-color 0.2s ease-in-out;
          `}
          style={{
            backgroundColor: the(currentTool).in('cursor', 'point-cursor')
              ? theme.color.surface4
              : 'transparent',
          }}
          onClick={handleChangeToCursorMode}
        >
          {currentTool === 'point-cursor' ? (
            <CursorLine width={24} />
          ) : (
            <Cursor css="width:24px; vertical-align:bottom;" />
          )}
        </div>

        {activeLayer?.layerType === 'vector' && (
          <div
            css={`
              ${centering()}
              padding:4px;
              border-radius: 0;
              transition: background-color 0.2s ease-in-out;
            `}
            style={{
              backgroundColor:
                currentTool === 'shape-pen'
                  ? theme.color.surface4
                  : 'transparent',
            }}
            onClick={handleChangeToShapePenMode}
          >
            <Pencil css="width:24px;" />
          </div>
        )}

        {(activeLayer?.layerType === 'raster' ||
          activeLayer?.layerType === 'vector') && (
          <div
            ref={brushesFl.reference}
            css={`
              position: relative;
              ${centering()}
              padding:4px;
              border-radius: 0;
              transition: background-color 0.2s ease-in-out;
            `}
            style={{
              backgroundColor:
                currentTool === 'draw' ? theme.color.surface4 : 'transparent',
            }}
            onClick={handleChangeToPencilMode}
          >
            <span
              css={`
                position: absolute;
                top: -2px;
                left: 50%;
                display: inline-block;
                padding-left: none !important;
                padding-right: none !important;
                transform: translateX(-50%);
                border: 4px solid;
                border-color: transparent transparent #fff transparent;
                mix-blend-mode: difference;
                transition: opacity 0.2s ease-in-out;
                opacity: 0;
              `}
              style={{
                opacity: currentTool === 'draw' ? 1 : 0,
              }}
            />
            <Brush width={24} />
          </div>
        )}

        {(activeLayer?.layerType === 'raster' ||
          activeLayer?.layerType === 'vector') && (
          <div
            css={`
              ${centering()}
              padding: 4px;
            `}
            style={{
              backgroundColor:
                currentTool === 'dropper'
                  ? theme.color.surface4
                  : 'transparent',
            }}
            onClick={handleChangeToDropperMode}
          >
            <Sip width={24} />
          </div>
        )}

        {activeLayer?.layerType === 'raster' && (
          <div
            css={`
              ${centering()}
              padding: 4px;
              border-radius: 0 60px 60px 0;
              transition: background-color 0.2s ease-in-out;
            `}
            style={{
              backgroundColor:
                currentTool === 'erase' ? theme.color.surface4 : 'transparent',
            }}
            onClick={handleChangeToEraceMode}
          >
            <Eraser
              css={`
                width: 24px;
                vertical-align: bottom;
              `}
            />
          </div>
        )}

        <Portal>
          <FloatMenu
            ref={brushesFl.floating}
            style={{
              position: brushesFl.strategy,
              left: brushesFl.x ?? 0,
              top: brushesFl.y ?? 0,
              ...(brushOpened
                ? { opacity: 1, pointerEvents: 'all' }
                : { opacity: 0, pointerEvents: 'none' }),
            }}
          >
            <BrushPresets />
            <FloatMenuArrow
              ref={brushesArrowRef}
              style={{
                left: brushesFl.middlewareData.arrow?.x ?? 0,
                top: brushesFl.middlewareData.arrow?.y ?? 0,
              }}
            />
          </FloatMenu>
        </Portal>
      </div>

      {/* {isNarrowMedia && ( */}
      <div
        ref={layersFl.reference}
        css={`
          position: relative;
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

        <div data-ignore-click>
          <FloatMenu
            ref={layersFl.floating}
            css={`
              width: 300px;
            `}
            style={{
              ...(layersOpened
                ? { opacity: 1, pointerEvents: 'all' }
                : { opacity: 0, pointerEvents: 'none' }),
              position: layersFl.strategy,
              top: layersFl.y ?? '',
              left: layersFl.x ?? '',
            }}
          >
            <LayerFloatMenu />
            <FloatMenuArrow
              ref={layersArrowRef}
              style={{
                left: layersFl.middlewareData.arrow?.x ?? 0,
              }}
            />
          </FloatMenu>
        </div>
      </div>
      {/* )} */}
    </div>
  )
})

const AppMenu = memo(function AppMenu({
  opened,
  onClose,
}: {
  opened: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('app')
  const { execute, getStore } = useFleur()

  const { engine, currentTheme, currentDocument } = useStore((get) => ({
    engine: get(EditorStore).state.engine,
    currentTheme: EditorSelector.currentTheme(get),
    currentDocument: EditorSelector.currentDocument(get),
  }))

  const fl = useFloating({
    placement: 'top',
    middleware: [shift({ padding: 8 })],
  })

  const handleClickBackToHome = useFunk(() => {
    execute(EditorOps.disposeEngineAndSession, {
      withSave: true,
      switchToHome: true,
    })
  })

  const handleClickChangeTheme = useFunk(() => {
    execute(EditorOps.setTheme, currentTheme === 'dark' ? 'light' : 'dark')
    onClose()
  })

  const handleClickSave = useFunk(() => {
    if (!currentDocument) return

    execute(EditorOps.saveCurrentDocumentToIdb, { notify: true })
    onClose()
  })

  const handleClickSaveAs = useFunk(() => {
    if (!currentDocument) return

    execute(NotifyOps.create, {
      area: 'loadingLock',
      lock: true,
      messageKey: 'appMenu.saving',
      timeout: 0,
    })

    const { blob } = exportProject(currentDocument, getStore)
    const url = URL.createObjectURL(blob)
    letDownload(
      url,
      !currentDocument.title
        ? `${t('untitled')}.paplc`
        : `${currentDocument.title}.paplc`
    )

    onClose()

    window.setTimeout(() => {
      execute(NotifyOps.create, {
        area: 'loadingLock',
        lock: false,
        messageKey: 'appMenu.saved',
        timeout: 0,
      })
    }, /* フィードバックが早すぎると何が起きたかわからないので */ 1000)

    window.setTimeout(() => URL.revokeObjectURL(url), 3000)
  })

  const handleClickExportAs = useFunk(async () => {
    if (!currentDocument || !engine) return

    execute(NotifyOps.create, {
      area: 'loadingLock',
      lock: true,
      messageKey: 'appMenu.exporting',
      timeout: 0,
    })

    const exporter = await engine.renderAndExport(currentDocument)
    const blob = await exporter.export('image/png')
    const url = URL.createObjectURL(blob)
    letDownload(
      url,
      !currentDocument.title
        ? `${t('untitled')}.png`
        : `${currentDocument.title}.png`
    )

    onClose()

    window.setTimeout(() => {
      execute(NotifyOps.create, {
        area: 'loadingLock',
        lock: false,
        messageKey: 'appMenu.exported',
        timeout: 0,
      })
    }, /* フィードバックが早すぎると何が起きたかわからないので */ 1000)

    window.setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 3000)
  })

  const handleClickReload = useFunk(async () => {
    execute(NotifyOps.create, {
      area: 'loadingLock',
      lock: true,
      messageKey: 'リロード中',
      timeout: 0,
    })

    window.location.reload()
  })

  useAutoUpdateFloating(fl)

  return (
    <div ref={fl.floating}>
      <Portal>
        <ActionSheet
          css={css`
            color: ${({ theme }) => theme.colors.blue50};
          `}
          opened={opened}
          onClose={onClose}
          fill={false}
        >
          <ActionSheetItemGroup>
            <ActionSheetItem onClick={handleClickChangeTheme}>
              テーマ切り替え
            </ActionSheetItem>
          </ActionSheetItemGroup>

          <ActionSheetItemGroup>
            <ActionSheetItem onClick={handleClickSave}>保存</ActionSheetItem>
            <ActionSheetItem onClick={handleClickSaveAs}>
              アイテムをダウンロードして保存
            </ActionSheetItem>
            <ActionSheetItem onClick={handleClickExportAs}>
              画像に書き出し
            </ActionSheetItem>
          </ActionSheetItemGroup>

          <ActionSheetItemGroup>
            <ActionSheetItem onClick={handleClickBackToHome}>
              保存してホームへ戻る
            </ActionSheetItem>
          </ActionSheetItemGroup>

          {process.env.NODE_ENV === 'development' && (
            <ActionSheetItemGroup>
              <ActionSheetItem onClick={handleClickReload}>
                リロード
              </ActionSheetItem>
            </ActionSheetItemGroup>
          )}

          <ActionSheetItemGroup>
            <ActionSheetItem onClick={onClose}>キャンセル</ActionSheetItem>
          </ActionSheetItemGroup>
        </ActionSheet>
      </Portal>
    </div>
  )
})

const VectorColorPicker = memo(function VectorColorPicker({
  opened,
  target,
  onClose,
}: {
  opened: boolean
  target: 'fill' | 'stroke'
  // color: Color
  // onChange: ColorChangeHandler
  // onChangeComplete: ColorChangeHandler
  onClose: () => void
}) {
  const { t } = useTranslation('app')

  const { execute } = useFleur()
  const {
    currentVectorBrush,
    currentVectorFill,
    defaultVectorBrush,
    activeObject,
    activeLayerPath,
  } = useStore((get) => ({
    currentVectorBrush: EditorSelector.currentVectorBrush(get),
    currentVectorFill: EditorSelector.currentVectorFill(get),
    defaultVectorBrush: EditorSelector.defaultVectorBrush(get),
    activeObject: EditorSelector.activeObject(get),
    activeLayerPath: EditorSelector.activeLayerPath(get),
  }))

  // const targetSurface = target === 'fill' ? activeObject.fill?.type : activeObject!.brush

  const [currentTab, setTab] = useBufferedState<'solid' | 'gradient' | 'none'>(
    // prettier-ignore
    (target === 'fill' ? (
        activeObject?.fill?.type === 'fill' ? 'solid'
        : activeObject?.fill?.type === 'linear-gradient' ? 'gradient'
        : null
      )
      : target === 'stroke' ? 'solid' : null) ?? 'solid'
  )
  const [gradientIndices, setGradientIndices] = useState<number[]>([])
  const [currentColor, setFillColor] = useBufferedState<RGBColor>(() =>
    currentVectorFill?.type === 'fill'
      ? normalRGBAToRGBA(currentVectorFill.color)
      : {
          r: 0,
          g: 0,
          b: 0,
        }
  )

  const [gradientLength, setGradientLength] = useBufferedState(() => {
    if (activeObject?.fill?.type !== 'linear-gradient') return 0

    const fill = activeObject?.fill
    return PapWebMath.distanceOfPoint(fill.start, fill.end)
  })

  const [gradientAngle, setGradientAngle] = useBufferedState(() => {
    if (activeObject?.fill?.type !== 'linear-gradient') return 0

    const fill = activeObject?.fill
    const rad = PapWebMath.angleOfPoints(fill.start, fill.end)
    return PapWebMath.normalizeDegree(PapWebMath.radToDeg(rad) + 180)
  })

  const arrowRef = useRef<HTMLDivElement | null>(null)
  const fl = useFloating({
    placement: 'top',
    middleware: [
      shift(),
      offset(8),
      // autoPlacement({ alignment: 'start' }),
      arrow({ element: arrowRef }),
    ],
  })

  const [showGradLen, toggleShowGradLen] = useToggle(false)
  const [showGradAngle, toggleShowGradAngle] = useToggle(false)

  const cmdTransaction = useTransactionCommand()

  const handleClickTab = useFunk((nextTab) => {
    setTab(nextTab)

    if (!activeLayerPath || !activeObject) return

    if (target === 'fill') {
      if (currentTab === 'solid' && nextTab === 'gradient') {
        execute(EditorOps.updateActiveObject, (o) => {
          const fill = o.fill
          if (fill?.type !== 'fill') return

          o.fill = {
            type: 'linear-gradient',
            colorStops: [{ position: 0, color: { ...fill.color, a: 1 } }],
            opacity: 1,
            start: { x: -10, y: -10 },
            end: { x: 10, y: 10 },
          }
        })
      }

      if (currentTab === 'gradient' && nextTab === 'solid') {
        // Swap gradient and solid in object fill
        execute(EditorOps.updateActiveObject, (o) => {
          const fill = o.fill
          if (fill?.type !== 'linear-gradient') return

          o.fill = {
            type: 'fill',
            color: pick(fill.colorStops[0].color, ['r', 'g', 'b']),
            opacity: 1,
          }
        })
      }

      if (nextTab === 'none') {
        if (!activeLayerPath || !activeObject) return

        execute(
          EditorOps.runCommand,
          new PapCommands.VectorLayer.PatchObjectAttr({
            pathToTargetLayer: activeLayerPath,
            objectUid: activeObject.uid,
            patcher: (attrs) => {
              attrs.fill = null
            },
          })
        )
      }
    }

    if (target === 'stroke') {
      if (nextTab === 'none') {
        execute(
          EditorOps.runCommand,
          new PapCommands.VectorLayer.PatchObjectAttr({
            pathToTargetLayer: activeLayerPath,
            objectUid: activeObject.uid,
            patcher: (attrs) => {
              attrs.brush = null
            },
          })
        )
      }

      if (nextTab === 'solid') {
        execute(
          EditorOps.runCommand,
          new PapCommands.VectorLayer.PatchObjectAttr({
            pathToTargetLayer: activeLayerPath,
            objectUid: activeObject.uid,
            patcher: (attrs) => {
              attrs.brush = {
                ...defaultVectorBrush,
                ...attrs.brush,
                color: toRationalColor(currentColor),
                opacity: currentColor.a != null ? currentColor.a * 100 : 100,
              }
            },
          })
        )
      }

      if (currentTab === 'solid' && nextTab === 'gradient') {
        // Unsupported currently
      }

      if (currentTab === 'gradient' && nextTab === 'solid') {
        // Unsupported currently
        // execute(EditorOps.updateActiveObject, (o) => {
        //   const stroke = <o className="bru"></o>
        //   if (stroke?.type !== 'linear-gradient') return
        //   o.stroke = {
        //     type: 'fill',
        //     color: pick(stroke.colorStops[0].color, ['r', 'g', 'b']),
        //     opacity: 1,
        //   }
        // })
      }
    }

    // fl.update()
  })

  const handleChangeColor: ColorChangeHandler = useFunk(({ rgb }) => {
    setFillColor(rgb)
  })

  const handleChangeCompleteColor: ColorChangeHandler = useFunk(({ rgb }) => {
    setFillColor(rgb)

    if (!activeLayerPath || !activeObject) return

    if (target === 'fill') {
      execute(EditorOps.updateActiveObject, (obj) => {
        if (!obj.fill) {
          obj.fill = {
            type: 'fill',
            opacity: rgb.a ?? 1,
            color: toRationalColor(rgb),
          }
        }

        if (obj.fill.type === 'fill') {
          obj.fill = { ...obj.fill, color: toRationalColor(rgb) }
        } else if (obj.fill.type === 'linear-gradient') {
          const nextColorStops = deepClone(obj.fill.colorStops)
          gradientIndices.forEach((i) => {
            nextColorStops[i].color = toRationalRgba(rgb)
          })

          obj.fill = {
            ...obj.fill,
            colorStops: nextColorStops,
          }
        }
      })
    } else {
      // Stroke

      execute(
        EditorOps.runCommand,
        new PapCommands.VectorLayer.PatchObjectAttr({
          pathToTargetLayer: activeLayerPath,
          objectUid: activeObject.uid,
          patcher: (attrs) => {
            attrs.brush = {
              ...defaultVectorBrush,
              ...attrs.brush,
              color: toRationalColor(rgb),
              opacity: rgb.a ?? 1,
            }
          },
        })
      )
    }
  })

  const handleChangeGradient = useFunk(
    (colorStops: PapValueTypes.ColorStop[]) => {
      execute(EditorOps.updateActiveObject, (obj) => {
        if (obj.fill?.type !== 'linear-gradient') return

        obj.fill = {
          ...obj.fill,
          colorStops,
        }
      })
    }
  )

  const handleChangeGradientIndices = useFunk((indices: number[]) => {
    if (activeObject?.fill?.type !== 'linear-gradient') return

    setGradientIndices(indices)

    const { color } = activeObject.fill.colorStops[indices[0]]
    setFillColor(normalRGBAToRGBA(color))
  })

  const handleChangeGradientLength = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath || activeObject?.fill?.type !== 'linear-gradient')
        return

      setGradientLength(currentTarget.valueAsNumber)
      toggleShowGradLen(true)
      cmdTransaction.startIfNotStarted()

      const length = currentTarget.valueAsNumber / 2
      const fill = deepClone({ ...activeObject.fill })

      const rad = PapWebMath.angleOfPoints(fill.start, fill.end)
      const pointS = PapWebMath.pointByAngleAndDistance({
        angle: rad,
        distance: length,
        base: { x: 0, y: 0 },
      })

      const pointE = PapWebMath.pointByAngleAndDistance({
        angle: PapWebMath.degToRad(
          PapWebMath.deg(PapWebMath.radToDeg(rad) + 180)
        ),
        distance: length,
        base: { x: 0, y: 0 },
      })

      fill.start = pointS
      fill.end = pointE

      if (target === 'fill') {
        cmdTransaction.doAndAdd(
          new PapCommands.VectorLayer.PatchObjectAttr({
            pathToTargetLayer: activeLayerPath,
            objectUid: activeObject.uid,
            patcher: (attrs) => {
              attrs.fill = fill
            },
          })
        )
      }
    }
  )

  const handleCompleteGradientLength = useFunk(() => {
    toggleShowGradLen(false)
    cmdTransaction.commit()
  })

  const handleChangeGradientAngle = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath || activeObject?.fill?.type !== 'linear-gradient')
        return

      toggleShowGradAngle(true)
      setGradientAngle(currentTarget.valueAsNumber)
      cmdTransaction.startIfNotStarted()

      const nextFill = deepClone({ ...activeObject.fill })
      const rad = PapWebMath.degToRad(
        PapWebMath.deg(currentTarget.valueAsNumber)
      )
      const length = PapWebMath.distanceOfPoint(nextFill.start, nextFill.end)

      const pointS = PapWebMath.pointByAngleAndDistance({
        angle: rad,
        distance: length / 2,
        base: { x: 0, y: 0 },
      })

      const pointE = PapWebMath.pointByAngleAndDistance({
        angle: PapWebMath.degToRad(
          PapWebMath.deg(PapWebMath.radToDeg(rad) + 180)
        ),
        distance: length / 2,
        base: { x: 0, y: 0 },
      })

      nextFill.start = pointS
      nextFill.end = pointE

      // console.log({
      //   expect: currentTarget.valueAsNumber,
      //   act: SilkWebMath.radToDeg(SilkWebMath.angleOfPoints(pointS, pointE)),
      // })

      if (target === 'fill') {
        cmdTransaction.doAndAdd(
          new PapCommands.VectorLayer.PatchObjectAttr({
            pathToTargetLayer: activeLayerPath,
            objectUid: activeObject.uid,
            patcher: (attrs) => {
              attrs.fill = nextFill
            },
          })
        )
      }
    }
  )

  const handleCompleteGradientAngle = useFunk(() => {
    toggleShowGradAngle(false)
    cmdTransaction.commit()
  })

  useClickAway(fl.refs.floating, onClose)

  useEffect(() => {
    fl.reference(fl.refs.floating.current!.parentElement)

    if (!fl.refs.floating.current || !fl.refs.reference.current) return
    autoUpdate(fl.refs.reference.current, fl.refs.floating.current, fl.update)
  }, [fl.refs.floating.current])

  useVectorObjectWatch(activeObject)

  return (
    <div
      ref={fl.floating}
      css={css`
        width: 300px;
        border-radius: 4px;
        filter: drop-shadow(0 0 1px ${({ theme }) => theme.colors.surface6});
        ${tm((o) => [o.bg.surface2])}
      `}
      style={{
        position: fl.strategy,
        left: fl.x ?? 0,
        top: fl.y ?? 0,
        ...(opened
          ? { opacity: 1, pointerEvents: 'all' }
          : { opacity: 0, pointerEvents: 'none' }),
      }}
      data-ignore-click
    >
      <div>
        <div
          css={`
            position: relative;
          `}
        >
          {currentTab === 'gradient' && (
            <>
              <GradientSlider
                colorStops={
                  currentVectorFill?.colorStops ?? [
                    { color: { r: 0, g: 0, b: 0, a: 1 }, position: 0 },
                    { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 },
                  ]
                }
                onChange={handleChangeGradient}
                onChangeSelectIndices={handleChangeGradientIndices}
              />

              <label
                css={`
                  position: relative;
                  ${centering()}
                  padding: 4px 8px;
                `}
              >
                <span
                  css={`
                    display: inline-block;
                    margin-right: 8px;
                  `}
                >
                  {t('mainActions.gradientLength')}
                </span>
                <RangeInput
                  min={0}
                  max={1000}
                  step={0.1}
                  value={gradientLength}
                  onChange={handleChangeGradientLength}
                  onChangeComplete={handleCompleteGradientLength}
                />

                <Tooltip2
                  placement="right-end"
                  strategy="absolute"
                  show={showGradLen}
                >
                  {gradientLength}
                </Tooltip2>
              </label>
              <label
                css={`
                  position: relative;
                  ${centering()}
                  padding: 4px 8px;
                `}
              >
                <span
                  css={`
                    display: inline-block;
                    margin-right: 8px;
                  `}
                >
                  {t('mainActions.gradientAngle')}
                </span>
                <RangeInput
                  min={0}
                  max={360}
                  step={0.1}
                  value={gradientAngle}
                  onChange={handleChangeGradientAngle}
                  onChangeComplete={handleCompleteGradientAngle}
                />

                <Tooltip2
                  placement="right-end"
                  strategy="absolute"
                  show={showGradAngle}
                >
                  {gradientAngle}
                </Tooltip2>
              </label>
            </>
          )}

          <CustomColorPicker
            color={currentColor}
            onChange={handleChangeColor}
            onChangeComplete={handleChangeCompleteColor}
          />
        </div>
        {/* )} */}
        {/* {target === 'stroke' && currentVectorBrush && (
          <ChromePicker
            css={`
              position: absolute;
              left: 50%;
              bottom: 100%;
              transform: translateX(-50%);
            `}
            color={
              activeObject?.brush?.color
                ? {
                    r: activeObject?.brush?.color.r * 255,
                    g: activeObject?.brush?.color.g * 255,
                    b: activeObject?.brush?.color.b * 255,
                  }
                : currentVectorBrush.color
            }
            onChange={handleChangeStrokeColor}
            onChangeComplete={handleChangeStrokeColor}
          />
        )} */}

        <TabBar>
          <Tab
            tabName="none"
            active={currentTab === 'none'}
            onClick={handleClickTab}
          >
            {t('vectorColorPicker.modes.none')}
          </Tab>
          <Tab
            tabName="solid"
            active={currentTab === 'solid'}
            onClick={handleClickTab}
          >
            {t('vectorColorPicker.modes.solid')}
          </Tab>
          {target === 'fill' && (
            <Tab
              tabName="gradient"
              active={currentTab === 'gradient'}
              onClick={handleClickTab}
            >
              {t('vectorColorPicker.modes.gradient')}
            </Tab>
          )}
        </TabBar>

        <div
          ref={arrowRef}
          css={css`
            position: absolute;
            top: 100%;
            border: 6px solid transparent;
            border-color: ${({ theme }) =>
              `${theme.color.surface2} transparent transparent transparent`};
          `}
          style={{
            left: fl.middlewareData.arrow?.x ?? 0,
            // top: fl.middlewareData.arrow?.y ?? 0,
          }}
        />
      </div>
    </div>
  )
})

const BrushColorPicker = memo(
  CustomPicker<{ disableAlpha?: boolean }>(function BrushColorPicker(props) {
    return (
      <div
        css={css`
          width: 300px;
          border-radius: 4px;
          filter: drop-shadow(0 0 1px ${({ theme }) => theme.colors.surface6});
          ${tm((o) => [o.bg.surface2])}
        `}
        data-ignore-click
      >
        <CustomColorPicker {...props} />
      </div>
    )
  })
)

const CustomColorPicker = CustomPicker<{ disableAlpha?: boolean }>(
  function CustomColorPicker(props) {
    const [stringValue, setStringValue] = useBufferedState(
      rgbToColorString({
        red: props.rgb?.r ?? 0,
        green: props.rgb?.g ?? 0,
        blue: props.rgb?.b ?? 0,
      }).slice(1)
    )

    const handleChangeColor = useFunk(
      ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
        const color = currentTarget.value.replace(/#/g, '')
        console.log(color)
        setStringValue(color)
      }
    )

    const handleCompleteColor = useFunk(
      ({ currentTarget }: KeyboardEvent<HTMLInputElement>) => {
        const color = currentTarget.value.replace(/#/g, '')
        setStringValue(color)
        props.onChange?.(`#${color}`)
      }
    )

    return (
      <div
        css={`
          position: relative;
          display: flex;
          flex-flow: column;
          gap: 8px;
          padding-bottom: 8px;
        `}
      >
        {/* <Hue {...props} direction="vertical" /> */}
        <div
          css={`
            position: relative;
            width: 100%;
            height: 100px;
            padding: 8px 8px 0;
          `}
        >
          <Saturation
            {...props}
            onChange={props.onChange!}
            pointer={HuePointer}
          />
        </div>
        <div
          css={`
            position: relative;
            height: 8px;
            margin: 0 8px;
          `}
        >
          <Hue {...props} onChange={props.onChange!} pointer={Pointer} />
        </div>

        {!props.disableAlpha && (
          <div
            css={`
              position: relative;
              height: 8px;
              margin: 0 8px;
            `}
          >
            <Alpha {...props} onChange={props.onChange!} pointer={Pointer} />
          </div>
        )}

        <div
          css={`
            display: flex;
            align-items: center;
            justify-content: flex-end;
            position: relative;
            margin: 0 8px;
            text-align: right;
          `}
        >
          #
          <TextInput
            css={`
              width: 6em;
            `}
            sizing="sm"
            value={stringValue}
            onChange={handleChangeColor}
            onComplete={handleCompleteColor}
          />
        </div>

        {/* <ChromePicker {...props} /> */}
      </div>
    )
  }
)

const HuePointer = styled.div.withConfig({
  shouldForwardProp: (prop, valid) => prop !== 'color' && valid(prop),
})`
  width: 10px;
  height: 10px;
  border: 1px solid #fff;
  box-shadow: inset 0 0 0 0.5px #000, 0 0 0 0.5px #000;
  border-radius: 100px;
  transform: translate(-50%, -50%);
`

const Pointer = styled.div.withConfig({
  shouldForwardProp: (prop, valid) => prop !== 'color' && valid(prop),
})`
  width: 12px;
  height: 12px;
  border-radius: 100px;
  background-color: ${({ theme }) => theme.exactColors.white60};
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
`

const NoColorSlash = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 180%;
  height: 5px;
  background-color: hsl(0, 75%, 60%);
  border: 1px solid hsl(0, 0%, 85%);
  transform: translate(-50%, -50%) rotate(-45deg);
  border-radius: 4px;
  pointer-events: none;
`

const toRationalColor = ({ r, g, b }: { r: number; g: number; b: number }) => ({
  r: r / 255,
  g: g / 255,
  b: b / 255,
})

const toRationalRgba = (color: {
  r: number
  g: number
  b: number
  a?: number
}) => {
  return { ...toRationalColor(color), a: color.a ?? 1 }
}
