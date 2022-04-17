import { useDrag, useGesture } from 'react-use-gesture'
import useMeasure from 'use-measure'
import { SilkHelper, SilkValue } from 'silk-core'
import { deepClone } from '🙌/utils/clone'
import {
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  useRef,
  useState,
} from 'react'
import {
  colorStopsToCssGradient,
  normalRgbToRgbArray,
} from '🙌/features/Paint/helpers'
import { rgba } from 'polished'
import { useBufferedState } from '🙌/utils/hooks'
import { SilkWebMath } from '🙌/utils/SilkWebMath'
import { nanoid } from 'nanoid'
import { useFunk } from '@hanakla/arma'
import { DOMUtils } from '🙌/utils/dom'
import { any } from '🙌/utils/anyOf'
import { checkerBoard } from '🙌/utils/mixins'

type Props = {
  colorStops: SilkValue.ColorStop[]
  onChange: (colorStops: SilkValue.ColorStop[]) => void
  onChangeSelectIndices: (indices: number[]) => void
}

export const GradientSlider = ({
  colorStops,
  onChange,
  onChangeSelectIndices,
}: Props) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const rect = useMeasure(rootRef)

  const [stops, setStops] = useBufferedState<
    SilkValue.ColorStop[],
    (SilkValue.ColorStop & { id: string })[]
  >(colorStops, (stops) => {
    return stops.map((s) => Object.assign({}, s, { id: nanoid() }))
  })

  const [activeId, setActiveIndex] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // const handleClick = useFunk(
  //   ({ currentTarget }: PointerEvent<HTMLDivElement>) => {
  //     console.log('a')

  // )

  const handleClickTrack = useFunk((e: MouseEvent<HTMLDivElement>) => {
    const clickPos = DOMUtils.getClickedPosisionInElement(e)
    if (clickPos.x < 0 || clickPos.x > rect.width) return

    const nextColorStops = deepClone(stops)
    const pos = clickPos.x / rect.width

    addColorStopAt(pos, nextColorStops)
    setStops(nextColorStops)
    onChange(nextColorStops.map(({ id, ...stop }) => stop))
  })

  const handleKeyDown = useFunk((e: KeyboardEvent<HTMLDivElement>) => {
    if (!any(e.key).in('Delete', 'Backspace')) return

    const index = +e.currentTarget.dataset.index!
    const nextColorStops = deepClone(stops)
    nextColorStops.splice(index, 1)
    setStops(nextColorStops)
    onChange(nextColorStops.map(({ id, ...stop }) => stop))
  })

  const bindDrag = useGesture(
    {
      onDrag: ({ event, ...e }) => {
        const index = +(event.currentTarget! as HTMLElement).dataset.index!
        const stop = stops[index]

        if (e.last) setDraggingId(null)
        if (event.buttons === 0 && !e.last) return
        if (draggingId !== null && draggingId !== stop.id) return

        setDraggingId(stop.id)

        const nextColorStops = deepClone(stops)

        if (e.first && e.altKey) {
          // clone current point
          nextColorStops.push({
            ...stop,
            id: nanoid(),
          })
        }

        if (e.last && e.movement[1] < -20) {
          // remove current point
          nextColorStops.splice(index, 1)
        } else {
          // update current point position
          const pos =
            ((event.currentTarget! as HTMLElement).offsetLeft + e.delta[0]) /
            rect.width

          if (pos < 0 || pos > 1) return
          nextColorStops[index].position = SilkWebMath.clamp(pos, 0, 1)
        }

        SilkHelper.sortColorStopsByPositionAsc(nextColorStops)

        setStops(nextColorStops)

        if (e.last) {
          setDraggingId(null)
          onChange(nextColorStops.map(({ id, ...stop }) => stop))
        }
      },
      onPointerDown: ({ event: { currentTarget } }) => {
        const id = (currentTarget as HTMLElement).dataset.id!
        const index = +(currentTarget as HTMLElement).dataset.index!

        setActiveIndex(id)
        onChangeSelectIndices([index])
      },
    },
    { drag: { threshold: 2, lockDirection: true } }
  )

  return (
    <div
      css={`
        padding: 24px 12px 4px;
      `}
    >
      <div
        ref={rootRef}
        css={`
          position: relative;
          width: 100%;
          height: 8px;
          background-color: ${rgba('#333', 0.2)};
          ${checkerBoard({ size: 8 })}
        `}
        role="slider"
        style={{
          transform: 'translateY(-6px)',
        }}
        onDoubleClick={handleClickTrack}
      >
        <div
          css={`
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 2px;
          `}
          style={{ backgroundImage: colorStopsToCssGradient(90, stops) }}
        />
        <div
          css={`
            position: relative;
            height: 14px;
            /* transform- */
          `}
        >
          {stops.map((colorStop, index) => (
            <div
              key={colorStop.id}
              css={`
                position: absolute;
                bottom: 100%;
                width: 14px;
                height: 14px;
                border-radius: 2px;
                transform: translate(-8px, -2px);
                border: 1px solid #eee;
                box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
                outline: none;
              `}
              style={{
                backgroundColor: rgba(
                  ...normalRgbToRgbArray(colorStop.color),
                  1
                ),
                left: `${colorStop.position * 100}%`,
                pointerEvents:
                  // prettier-ignore
                  draggingId == null ? 'auto'
                : draggingId !== colorStop.id ? 'none'
                : 'auto',
                zIndex: draggingId === colorStop.id ? 1 : 0,
                boxShadow:
                  activeId === colorStop.id
                    ? ` 0 0 0 2px ${rgba('#3694f6', 0.8)}`
                    : undefined,
              }}
              data-index={index}
              data-id={colorStop.id}
              onKeyDown={handleKeyDown}
              tabIndex={-1}
              {...bindDrag()}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export const addColorStopAt = (
  pos: number,
  colorStops: (SilkValue.ColorStop & { id: string })[]
) => {
  const id = nanoid()

  colorStops.push({
    id,
    color: null!,
    position: pos,
  })

  SilkHelper.sortColorStopsByPositionAsc(colorStops)
  const idx = colorStops.findIndex((s) => s.id === id)

  const previous = colorStops[idx - 1]
  const next = colorStops[idx + 1]

  if (previous && next) {
    colorStops[idx].color = {
      r: SilkWebMath.lerp(previous.color.r, next.color.r, 0.5),
      g: SilkWebMath.lerp(previous.color.g, next.color.g, 0.5),
      b: SilkWebMath.lerp(previous.color.b, next.color.b, 0.5),
      a: SilkWebMath.lerp(previous.color.a, next.color.a, 0.5),
    }
  } else if (!previous && next) {
    colorStops[idx].color = {
      r: next.color.r,
      g: next.color.g,
      b: next.color.b,
      a: next.color.a,
    }
  } else if (previous && !next) {
    colorStops[idx].color = {
      r: previous.color.r,
      g: previous.color.g,
      b: previous.color.b,
      a: previous.color.a,
    }
  }

  return colorStops
}
