import {
  memo,
  MouseEvent,
  MutableRefObject,
  Ref,
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
} from 'react-color'
import { Alpha, Hue, Saturation } from 'react-color/lib/components/common'
import { rgba, readableColor, rgb } from 'polished'
import { usePopper } from 'react-popper'
import { SilkBrushes, SilkValue } from 'silk-core'
import { useTranslation } from 'next-i18next'
import { useClickAway, useToggle } from 'react-use'
import { Brush, Close, Eraser, Pencil, Stack } from '@styled-icons/remix-line'
import { Cursor, Menu } from '@styled-icons/remix-fill'
import { css, useTheme } from 'styled-components'
import { Portal } from '🙌/components/Portal'
import { FloatMenu } from '🙌/components/FloatMenu'
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
  offset,
  shift,
  useFloating,
} from '@floating-ui/react-dom'
import { Tab, TabBar } from '🙌/components/TabBar'
import { useFleur } from '🙌/utils/hooks'
import { colorStopsToCssGradient, normalRGBAToRGBA } from '../../helpers'
import { GradientSlider } from '🙌/components/GradientSlider'
import { tm } from '🙌/utils/theme'
import { deepClone } from '🙌/utils/clone'
import { SilkWebMath } from '🙌/utils/SilkWebMath'
import { media } from '🙌/utils/responsive'
import { centering } from '🙌/utils/mixins'
import {
  ActionSheet,
  ActionSheetItem,
  ActionSheetItemGroup,
} from '🙌/components/ActionSheet'
import { exportProject } from '🙌/domains/EditorStable/exportProject'
import { NotifyOps } from '🙌/domains/Notify'

export const MainActions = memo(function MainActions() {
  const theme = useTheme()
  // const isNarrowMedia = useMedia(`(max-width: ${narrow})`)

  const { execute } = useFleur()
  const {
    currentVectorBrush,
    currentVectorFill,
    currentTool,
    brushSetting,
    activeLayer,
    activeObject,
    vectorColorTarget,
  } = useStore((get) => ({
    currentVectorBrush: EditorSelector.currentVectorBrush(get),
    currentVectorFill: EditorSelector.currentVectorFill(get),
    currentTool: get(EditorStore).state.currentTool,
    brushSetting: EditorSelector.currentBrushSetting(get),
    activeLayer: EditorSelector.activeLayer(get),
    activeObject: EditorSelector.activeObject(get),
    vectorColorTarget: EditorSelector.vectorColorTarget(get),
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
  const [appMenuOpened, toggleAppMenuOpened] = useToggle(false)
  const [pickerOpened, toggleColorPicker] = useToggle(false)
  const [brushOpened, toggleBrush] = useToggle(false)
  const [layersOpened, toggleLayers] = useToggle(false)
  const [vectorFillColorOpened, toggleVectorFillColorOpened] = useToggle(false)

  const [brushSize, setBrushSize] = useState(1)
  const [brushOpacity, setBrushOpacity] = useState(1)

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
      toggleBrush(true)
      return
    }

    execute(EditorOps.setTool, 'draw')
  })

  const handleChangeToEraceMode = useFunk(() => {
    execute(EditorOps.setTool, 'erase')
  })

  const handleChangeBrush = useFunk((id: string) => {
    execute(EditorOps.setBrushSetting, { brushId: id })
  })

  const handleClickColor = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (colorPickerPopRef.current!.contains(e.target as HTMLElement)) return
    toggleColorPicker()
  })

  const handleClickLayerIcon = useFunk((e: MouseEvent<HTMLDivElement>) => {
    if (DOMUtils.closestOrSelf(e.target, '[data-ignore-click]')) return
    console.log(e.target, e.currentTarget)
    toggleLayers()
  })

  const handleClickVectorStrokeColor = useFunk(
    (e: MouseEvent<HTMLDivElement>) => {
      if (DOMUtils.isChildren(e.target, e.currentTarget)) return

      execute(EditorOps.setVectorColorTarget, 'stroke')
      // toggleVectorFillColorOpened(true)
    }
  )

  const handleClickVectorFillColor = useFunk(
    (e: MouseEvent<HTMLDivElement>) => {
      if (DOMUtils.isChildren(e.target, e.currentTarget)) return

      if (!vectorFillColorOpened) {
        execute(EditorOps.setVectorColorTarget, 'fill')
      }

      toggleVectorFillColorOpened()
    }
  )

  const appMenuOpenerRef = useRef<HTMLDivElement | null>(null)

  const brushRef = useRef<HTMLDivElement | null>(null)
  const brushPopRef = useRef<HTMLDivElement | null>(null)
  const brushPopper = usePopper(brushRef.current, brushPopRef.current, {
    strategy: 'fixed',
    placement: 'top-start',
  })

  const layerRef = useRef<HTMLDivElement | null>(null)
  const layerPopRef = useRef<HTMLDivElement | null>(null)

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

  const vectorColorPopper = usePopper(layerRef.current, layerPopRef.current, {
    strategy: 'fixed' ?? '',
    placement: 'top-start',
  })

  useEffect(() => {
    if (
      !layersFloat.refs.reference.current ||
      !layersFloat.refs.floating.current
    )
      return

    return autoUpdate(
      layersFloat.refs.reference.current,
      layersFloat.refs.floating.current,
      layersFloat.update
    )
  }, [layersFloat.refs.reference.current, layersFloat.refs.floating.current, layersFloat.update])

  useClickAway(appMenuOpenerRef, (e) => {
    if (DOMUtils.isChildren(e.target, e.currentTarget)) return
    toggleAppMenuOpened(false)
  })

  useClickAway(colorPickerPopRef, (e) => {
    if (DOMUtils.childrenOrSelf(e.target, colorPickerPopRef.current)) return
    if (pickerOpened) toggleColorPicker(false)
  })

  useClickAway(brushPopRef, (e) => {
    if (DOMUtils.childrenOrSelf(e.target, brushRef.current)) return
    if (brushOpened) toggleBrush(false)
  })

  useClickAway(
    layersFloat.refs.reference as MutableRefObject<HTMLElement>,
    (e) => {
      if (DOMUtils.childrenOrSelf(e.target, layersFloat.refs.floating.current))
        return

      // console.log(e.target, layersFloat.refs.floating.current)
      toggleLayers(false)
    }
  )
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

  return (
    <div
      css={css`
        display: flex;
        gap: 8px;
        padding: 8px 16px;
        margin-bottom: env(safe-area-inset-bottom);
        background-color: ${({ theme }) => theme.color.surface2};
        border-radius: 100px;
        color: ${({ theme }) => theme.color.text1};
        border: 1px solid #aaa;
        white-space: nowrap;
        touch-action: manipulation;

        ${media.narrow`
          border: none;
          border-top: 1px solid #aaa;
          border-radius: 0;
          padding-bottom: 24px;
        `}
      `}
    >
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
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border: 1px solid;
            border-color: ${({ theme }) => theme.color.surface8};
            border-radius: 64px;
          `}
          {...bindBrushSizeDrag()}
        >
          {(Math.round(brushSize * 10) / 10).toString(10)}
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
                border: 2px solid transparent;
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
                border: 2px solid #dbdbdb;
                vertical-align: middle;
                box-shadow: 0 0 2px 1px rgba(0, 0, 0, 0.4);
              `}
              style={{
                zIndex: vectorColorTarget === 'fill' ? 1 : 0,
                // prettier-ignore
                background:
                  currentVectorFill?.type === 'fill'
                    ? rgba(
                        currentVectorFill.color.r,
                        currentVectorFill.color.g,
                        currentVectorFill.color.b,
                        currentVectorFill.opacity
                      )
                    : currentVectorFill?.type === 'linear-gradient'
                    ? colorStopsToCssGradient(
                        SilkWebMath.radToDeg(SilkWebMath.angleOfPoints(
                          currentVectorFill.start,
                          currentVectorFill.end
                        )),
                        currentVectorFill.colorStops
                      )
                    : undefined,
              }}
              onClick={handleClickVectorFillColor}
            />

            <VectorColorPicker
              opened={vectorFillColorOpened}
              target={vectorColorTarget}
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
            backgroundColor:
              currentTool === 'cursor' ? theme.color.surface6 : 'transparent',
          }}
          onClick={handleChangeToCursorMode}
        >
          <Cursor css="width:24px; vertical-align:bottom;" />
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
                  ? theme.color.surface6
                  : 'transparent',
            }}
            onClick={handleChangeToShapePenMode}
          >
            <Pencil css="width:24px;" />
          </div>
        )}

        <div
          ref={brushRef}
          css={`
            ${centering()}
            padding:4px;
            border-radius: 0;
            transition: background-color 0.2s ease-in-out;
          `}
          style={{
            backgroundColor:
              currentTool === 'draw' ? theme.color.surface6 : 'transparent',
          }}
          onClick={handleChangeToPencilMode}
        >
          <Brush css="width:24px; vertical-align:bottom;" />
        </div>

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
                currentTool === 'erase' ? theme.color.surface6 : 'transparent',
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
            <LayerFloatMenu ref={layerPopRef} />

            <div
              ref={layersArrowRef}
              css={css`
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
      </div>
      {/* )} */}
    </div>
  )
})

const BrushItem = memo(
  ({
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
          backgroundColor: active
            ? theme.exactColors.blueFade50
            : 'transparent',
        }}
        onClick={handleClick}
      >
        {name}
      </li>
    )
  }
)

const AppMenu = memo(
  ({ opened, onClose }: { opened: boolean; onClose: () => void }) => {
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

    const handleClickChangeTheme = useFunk(() => {
      execute(EditorOps.setTheme, currentTheme === 'dark' ? 'light' : 'dark')
      onClose()
    })

    const handleClickSave = useFunk(() => {
      if (!currentDocument) return

      execute(NotifyOps.create, {
        area: 'loadingLock',
        lock: true,
        message: t('appMenu.saving'),
        timeout: 0,
      })

      const { blob } = exportProject(currentDocument, getStore)
      const url = URL.createObjectURL(blob)
      letDownload(
        url,
        !currentDocument.title
          ? `${t('untitled')}.silk`
          : `${currentDocument.title}.silk`
      )

      onClose()

      window.setTimeout(() => {
        execute(NotifyOps.create, {
          area: 'loadingLock',
          lock: false,
          message: t('appMenu.saved'),
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
        message: t('appMenu.exporting'),
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
          message: t('appMenu.exported'),
          timeout: 0,
        })
      }, /* フィードバックが早すぎると何が起きたかわからないので */ 1000)

      window.setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 3000)
    })

    useEffect(() => {
      fl.refs.reference.current = fl.refs.floating.current!.parentElement

      if (!fl.refs.reference.current || !fl.refs.floating.current) return
      return autoUpdate(
        fl.refs.reference.current,
        fl.refs.floating.current,
        fl.update
      )
    })

    return (
      <div ref={fl.floating}>
        <Portal>
          <ActionSheet opened={opened} onClose={onClose} fill={false}>
            <ActionSheetItemGroup>
              <ActionSheetItem onClick={handleClickChangeTheme}>
                テーマ切り替え
              </ActionSheetItem>
            </ActionSheetItemGroup>

            <ActionSheetItemGroup>
              <ActionSheetItem onClick={handleClickSave}>
                ファイルを保存
              </ActionSheetItem>
              <ActionSheetItem onClick={handleClickExportAs}>
                画像に書き出し
              </ActionSheetItem>
            </ActionSheetItemGroup>

            <ActionSheetItemGroup>
              <ActionSheetItem onClick={onClose}>キャンセル</ActionSheetItem>
            </ActionSheetItemGroup>
          </ActionSheet>
        </Portal>
      </div>
    )
  }
)

const VectorColorPicker = memo(
  ({
    opened,
    target,
  }: {
    opened: boolean
    target: 'fill' | 'stroke'
    // color: Color
    // onChange: ColorChangeHandler
    // onChangeComplete: ColorChangeHandler
  }) => {
    const { t } = useTranslation('app')

    const { execute } = useFleur()
    const {
      currentVectorBrush,
      currentVectorFill,
      defaultVectorBrush,
      activeObject,
    } = useStore((get) => ({
      currentVectorBrush: EditorSelector.currentVectorBrush(get),
      currentVectorFill: EditorSelector.currentVectorFill(get),
      defaultVectorBrush: EditorSelector.defaultVectorBrush(get),
      activeObject: EditorSelector.activeObject(get),
    }))

    // const targetSurface = target === 'fill' ? activeObject.fill?.type : activeObject!.brush

    const [currentTab, setTab] = useState<'solid' | 'gradient'>(
      // prettier-ignore
      (target === 'fill' ? (
        activeObject?.fill?.type === 'fill' ? 'solid'
        : activeObject?.fill?.type === 'linear-gradient' ? 'gradient'
        : null
      )
      : target === 'stroke' ? 'solid' : null) ?? 'solid'
    )
    const [gradientIndices, setGradientIndices] = useState<number[]>([])
    const [fillColor, setFillColor] = useState<Color>(() =>
      activeObject?.fill?.type === 'fill'
        ? {
            r: activeObject?.fill.color.r * 255,
            g: activeObject?.fill.color.g * 255,
            b: activeObject?.fill.color.b * 255,
          }
        : {
            r: 0,
            g: 0,
            b: 0,
          }
    )

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

    const handleClickTab = useFunk((nextTab) => {
      setTab(nextTab)

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
      }

      if (target === 'stroke') {
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

    const handleChangeStrokeColor: ColorChangeHandler = useFunk(({ rgb }) => {
      execute(EditorOps.updateActiveObject, (obj) => {
        obj.brush = obj.brush
          ? { ...obj.brush, color: toRationalColor(rgb) }
          : {
              ...(currentVectorBrush ?? defaultVectorBrush),
              color: toRationalColor(rgb),
            }
      })
    })

    const handleChangeFillColor: ColorChangeHandler = useFunk(({ rgb }) => {
      setFillColor(rgb)

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
    })

    const handleChangeGradient = useFunk(
      (colorStops: SilkValue.ColorStop[]) => {
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

    useEffect(() => {
      fl.reference(fl.refs.floating.current!.parentElement)

      if (!fl.refs.floating.current || !fl.refs.reference.current) return
      autoUpdate(fl.refs.reference.current, fl.refs.floating.current, fl.update)
    }, [fl.refs.floating.current])

    return (
      <div
        ref={fl.floating}
        css={`
          border-radius: 4px;
          ${tm((o) => [o.bg.surface3, o.border.default])}
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
          {target === 'fill' && (
            <div
              css={`
                position: relative;
              `}
            >
              {currentVectorFill.type === 'linear-gradient' && (
                <GradientSlider
                  colorStops={currentVectorFill.colorStops}
                  onChange={handleChangeGradient}
                  onChangeSelectIndices={handleChangeGradientIndices}
                />
              )}

              <CustomColorPicker
                color={fillColor}
                onChangeComplete={handleChangeFillColor}
              />
            </div>
          )}
          {target === 'stroke' && currentVectorBrush && (
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
          )}

          <TabBar>
            <Tab
              tabName="solid"
              active={currentTab === 'solid'}
              onClick={handleClickTab}
            >
              {t('vectorColorPicker.modes.solid')}
            </Tab>
            <Tab
              tabName="gradient"
              active={currentTab === 'gradient'}
              onClick={handleClickTab}
            >
              {t('vectorColorPicker.modes.gradient')}
            </Tab>
          </TabBar>

          <div
            ref={arrowRef}
            css={css`
              position: absolute;
              top: 100%;
              border: 6px solid transparent;
              border-color: ${({ theme }) =>
                `${theme.color.surface6} transparent transparent transparent`};
            `}
            style={{
              left: fl.middlewareData.arrow?.x ?? 0,
              // top: fl.middlewareData.arrow?.y ?? 0,
            }}
          />
        </div>
      </div>
    )
  }
)

const CustomColorPicker = CustomPicker((props) => {
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
          height: 80px;
        `}
      >
        <Saturation {...props} onChange={props.onChange!} />
      </div>
      <div
        css={`
          position: relative;
          height: 8px;
          margin: 0 8px;
        `}
      >
        <Hue {...props} onChange={props.onChange!} />
      </div>

      <div
        css={`
          position: relative;
          height: 8px;
          margin: 0 8px;
        `}
      >
        <Alpha {...props} onChange={props.onChange!} />
      </div>
      {/* <ChromePicker {...props} /> */}
    </div>
  )
})

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
