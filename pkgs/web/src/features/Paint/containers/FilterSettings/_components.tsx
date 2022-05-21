import { flip, offset, shift, useFloating } from '@floating-ui/react-dom'
import { useFunk } from '@hanakla/arma'
import { PapCommands, PapDOM, PapDOMDigger } from '@paplico/core'
import { useTranslation } from 'next-i18next'
import { ChangeEvent, memo, MouseEvent, ReactNode, useEffect } from 'react'
import { useClickAway, useToggle } from 'react-use'

import { centering } from '🙌/utils/mixins'
import { DOMUtils } from '🙌/utils/dom'
import { ChromePicker, ColorChangeHandler } from 'react-color'
import { useAutoUpdateFloating, useFleur } from '../../../../utils/hooks'
import { Portal } from '../../../../components/Portal'
import { EditorOps, EditorSelector } from '../../../../domains/EditorStable'
import { useDocumentWatch, useTransactionCommand } from '../../hooks'
import { LayerTypes } from '@paplico/core/dist/DOM'
import { ThemeProp, tm } from '../../../../utils/theme'
import { rgba } from 'polished'
import { LayerNameText } from '../../../../components/LayerNameText'
import { useHover } from 'react-use-gesture'
import { ArrowDownS, ErrorWarning } from '@styled-icons/remix-line'
import { useStore } from '@fleur/react'
import { RangeInput } from '../../../../components/RangeInput'
import { roundString } from '../../../../utils/StringUtils'

export const Column = memo(
  ({
    nameKey,
    value,
    filter: { filterId },
    children,
  }: {
    nameKey: string
    value?: string
    filter: PapDOM.Filter
    children: ReactNode
  }) => {
    const { t } = useTranslation('app')

    return (
      <div>
        <div
          css={`
            flex: 1;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          `}
        >
          {t(`filterOptions.${filterId}.${nameKey}`)}
        </div>

        <div
          css={`
            display: flex;
            margin-top: 4px;
            flex: 1;
            flex-basis: 100%;
            gap: 4px;
          `}
        >
          <div
            css={`
              flex: 1;
            `}
          >
            {children}
          </div>

          {value !== undefined && (
            <div
              css={`
                ${centering({ x: false, y: true })}
                justify-content: flex-end;
                width: 40px;
                margin-left: auto;
                text-align: right;
              `}
            >
              {value}
            </div>
          )}
        </div>
      </div>
    )
  }
)

export const ColorInput = memo(
  ({
    alpha,
    value,
    onChange,
  }:
    | {
        alpha: true
        value: { r: number; g: number; b: number; a: number }
        onChange: (value: {
          r: number
          g: number
          b: number
          a: number
        }) => void
      }
    | {
        alpha?: false
        value: { r: number; g: number; b: number }
        onChange: (value: { r: number; g: number; b: number }) => void
      }) => {
    const [open, toggleOpen] = useToggle(false)
    const fl = useFloating({
      strategy: 'fixed',
      placement: 'right',
      middleware: [shift(), offset(4)],
    })

    const handleClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
      if (!DOMUtils.isSameElement(e.target, e.currentTarget)) return
      toggleOpen()
    })

    const handleChange = useFunk<ColorChangeHandler>(({ rgb }) => {
      onChange(
        (alpha
          ? {
              r: rgb.r / 255,
              g: rgb.g / 255,
              b: rgb.b / 255,
              a: rgb.a!,
            }
          : {
              r: rgb.r / 255,
              g: rgb.g / 255,
              b: rgb.b / 255,
            }) as any
      )
    })

    useAutoUpdateFloating(fl)

    useClickAway(fl.refs.floating, () => {
      toggleOpen(false)
    })

    return (
      <div
        ref={fl.reference}
        css={`
          width: 16px;
          height: 16px;
        `}
        style={{
          backgroundColor: `rgb(${value.r * 255}, ${value.g * 255}, ${
            value.b * 255
          })`,
        }}
        onClick={handleClick}
      >
        <Portal>
          <div
            ref={fl.floating}
            style={{
              position: fl.strategy,
              left: fl.x ?? 0,
              top: fl.y ?? 0,
              ...(open
                ? { opacity: 1, pointerEvents: 'all' }
                : { opacity: 0, pointerEvents: 'none' }),
            }}
          >
            <ChromePicker
              color={{
                r: value.r * 255,
                g: value.g * 255,
                b: value.b * 255,
              }}
              disableAlpha={!alpha}
              onChange={handleChange}
            />
          </div>
        </Portal>
      </div>
    )
  }
)

export const LayerSelector = memo(function LayerSelector({
  valueLayerUid,
  onChange,
}: {
  valueLayerUid: string | null
  onChange: (layerUid: string) => void
}) {
  const { execute } = useFleur()

  const { currentDocument, thumbnailUrlOfLayer } = useStore((get) => ({
    currentDocument: EditorSelector.currentDocument(get),
    thumbnailUrlOfLayer: EditorSelector.thumbnailUrlOfLayer(get),
  }))

  const [listOpened, toggleListOpened] = useToggle(false)

  if (!currentDocument) return null

  useDocumentWatch(currentDocument)

  const listFl = useFloating({
    strategy: 'fixed',
    placement: 'bottom',
    middleware: [shift(), flip(), offset(4)],
  })

  const handleClickBox = useFunk(() => {
    toggleListOpened()
  })

  const handleItemClick = useFunk((e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()

    toggleListOpened(false)
    onChange(e.currentTarget.dataset.layerUid!)
  })

  const bindLayerHover = useHover(({ hovering }) => {
    if (!valueLayerUid) return

    execute(EditorOps.setHighlightedLayers, (ids) => {
      if (hovering) return [...ids, valueLayerUid]
      else return ids.filter((id) => id !== valueLayerUid)
    })
  })

  const bindItemHover = useHover(({ hovering, event: { currentTarget } }) => {
    const layerUid = (currentTarget as HTMLDivElement).dataset.layerUid!

    execute(EditorOps.setHighlightedLayers, (ids) => {
      if (hovering) return [...ids, layerUid]
      else return ids.filter((id) => id !== layerUid)
    })
  })

  useClickAway(listFl.refs.floating, () => toggleListOpened(false))
  useAutoUpdateFloating(listFl)

  let selectedLayer = null as LayerTypes | null
  const layers: LayerTypes[] = []

  PapDOMDigger.traverseLayers(
    currentDocument,
    { kind: ['raster', 'vector', 'text'] },
    (layer) => {
      if (valueLayerUid === layer.uid) selectedLayer = layer
      layers.push(layer)
    }
  )

  return (
    <div>
      <div
        ref={listFl.reference}
        css={`
          position: relative;
          display: inline-block;
          width: 100%;
          padding: 4px;
          padding-right: 16px;
          border: 1px solid ${rgba('#aaa', 0.2)};
          border-radius: 4px;
          background-color: ${({ theme }: ThemeProp) => theme.color.surface3};
          color: ${({ theme }: ThemeProp) => theme.color.text2};

          &::placeholder {
            color: ${({ theme }: ThemeProp) => theme.exactColors.black30};
          }
        `}
        onClick={handleClickBox}
        {...bindLayerHover()}
      >
        {/* {currentItem?.label ?? (
          <span
            css={`
              opacity: 0.5;
            `}
          >
            {placeholder}
          </span>
        )} */}

        <span>
          {selectedLayer ? (
            <LayerNameText
              css={`
                padding: 0;
              `}
              name={selectedLayer.name}
              layerType={selectedLayer.layerType}
            />
          ) : (
            '----'
          )}
        </span>

        <ArrowDownS
          css={`
            position: absolute;
            right: 0;
            top: 50%;
            width: 16px;
            transform: translateY(-50%);
          `}
        />

        <Portal>
          <div
            ref={listFl.floating}
            css={`
              background-color: ${({ theme }: ThemeProp) =>
                rgba(theme.color.background2, 1)};
              filter: drop-shadow(0 0 5px ${rgba('#000', 0.5)});
              border-radius: 4px;
              overflow: hidden;
            `}
            style={{
              position: listFl.strategy,
              left: listFl.x ?? 0,
              top: listFl.y ?? 0,
              ...(listOpened
                ? { visibility: 'visible', pointerEvents: 'all' }
                : { visibility: 'hidden', pointerEvents: 'none' }),
            }}
          >
            {layers.map((layer) => (
              <div
                css={`
                  display: flex;
                  margin-right: 8px;
                `}
                data-layer-uid={layer.uid}
                onClick={handleItemClick}
                {...bindItemHover()}
              >
                <div
                  css={`
                    width: 32px;
                    height: 32px;
                    background-size: cover;
                    background-image: url(${thumbnailUrlOfLayer(layer.uid)});
                  `}
                />

                <LayerNameText name={layer.name} layerType={layer.layerType} />
              </div>
            ))}
          </div>
        </Portal>
      </div>

      {valueLayerUid != null && !selectedLayer && (
        <div
          css={`
            margin-top: 8px;
            ${tm((o) => [o.typography(12), o.font.text2])}
          `}
        >
          <ErrorWarning width={16} /> Target layer not found.
        </div>
      )}
    </div>
  )
})

export const OpacityColumn = memo(function OpacityColumn({
  filter,
}: {
  filter: PapDOM.Filter
}) {
  const transCommand = useTransactionCommand()

  const activeLayerPath = useStore(EditorSelector.activeLayerPath)

  const handleChangeOpacity = useFunk(
    ({ currentTarget }: ChangeEvent<HTMLInputElement>) => {
      if (!activeLayerPath) return

      transCommand.autoStartAndDoAdd(
        new PapCommands.Filter.PatchAttr({
          pathToTargetLayer: activeLayerPath,
          filterUid: filter.uid,
          patcher: (attrs) => {
            attrs.opacity = currentTarget.valueAsNumber
          },
        })
      )

      transCommand.rerenderCanvas()
    }
  )

  const handleChangeComplete = useFunk(() => {
    transCommand.commit()
  })

  return (
    <Column
      filter={filter}
      nameKey="opacity"
      value={roundString(filter.opacity * 100, 0)}
    >
      <RangeInput
        min={0}
        max={1}
        step={0.01}
        value={filter.opacity}
        onChange={handleChangeOpacity}
        onChangeComplete={handleChangeComplete}
      />
    </Column>
  )
})
