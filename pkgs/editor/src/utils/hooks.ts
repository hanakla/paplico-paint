import {
  DependencyList,
  useInsertionEffect,
  useMemo,
  useReducer,
  useRef,
  DOMAttributes,
  PointerEvent,
} from 'react'
import { useEventCallback } from '@paplico/shared-lib/react'

const useBrowserEffect =
  typeof window !== 'undefined' ? useInsertionEffect : () => {}

export function useMemoRevailidatable<T extends any>(
  factory: () => T,
  deps: DependencyList,
) {
  const [id, revalidate] = useReducer((s) => s + 1, 0)
  const value = useMemo<T>(factory, [id, ...deps])

  return [value, revalidate] as const
}

type DragGestureEvent = {
  event: PointerEvent
  first: boolean
  last: boolean
  canceled: boolean
  initial: [number, number]
  offsetInitial: [number, number]
  delta: [number, number]
  offsetDelta: [number, number]
  movement: [number, number]
  offsetMovement: [number, number]
}

type Positions = {
  clientX: number
  clientY: number
  offsetX: number
  offsetY: number
}

/** Fork version of @use-gesture/react's useDrag for PointerEvents */
export function usePointerDrag(handler: (e: DragGestureEvent) => void) {
  const handlerRef = useEventCallback(handler)

  const startPosition = useRef<Positions | null>(null)
  const prevPosition = useRef<Positions | null>(null)

  const handlers = useMemo(
    () =>
      ({
        onPointerDown: (e) => {
          // if memoize `event` directly, it will broken in Firefox 119
          const pos = (startPosition.current = {
            clientX: e.nativeEvent.clientX,
            clientY: e.nativeEvent.clientY,
            offsetX: e.nativeEvent.offsetX,
            offsetY: e.nativeEvent.offsetY,
          })

          prevPosition.current = { ...pos }

          e.currentTarget.setPointerCapture(e.pointerId)

          handlerRef({
            event: e,
            first: true,
            last: false,
            canceled: false,
            initial: [pos.clientX, pos.clientY],
            offsetInitial: [pos.offsetX, pos.offsetY],
            delta: [0, 0],
            offsetDelta: [0, 0],
            movement: [0, 0],
            offsetMovement: [0, 0],
          })
        },
        onPointerMove: (e) => {
          const ne = e.nativeEvent
          const source = startPosition.current
          const prev = prevPosition.current

          if (!source || !prev) return

          prevPosition.current = {
            clientX: ne.clientX,
            clientY: ne.clientY,
            offsetX: ne.offsetX,
            offsetY: ne.offsetY,
          }

          handlerRef({
            event: e,
            first: false,
            last: false,
            canceled: false,
            initial: [source.clientX, source.clientY],
            offsetInitial: [source.offsetX, source.offsetY],
            delta: [ne.clientX - prev.clientX, ne.clientY - prev.clientY],
            offsetDelta: [ne.offsetX - prev.offsetX, ne.offsetY - prev.offsetY],
            movement: [
              ne.clientX - source.clientX,
              ne.clientY - source.clientY,
            ],
            offsetMovement: [
              ne.offsetX - source.offsetX,
              ne.offsetY - source.offsetY,
            ],
          })
        },
        onPointerUp: (e) => {
          const ne = e.nativeEvent
          const source = startPosition.current
          const prev = prevPosition.current
          if (!source || !prev) return

          e.currentTarget.releasePointerCapture(ne.pointerId)
          startPosition.current = null
          prevPosition.current = null

          handlerRef({
            event: e,
            first: false,
            last: true,
            canceled: false,
            initial: [source.clientX, source.clientY],
            offsetInitial: [source.offsetX, source.offsetY],
            delta: [ne.clientX - prev.clientX, ne.clientY - prev.clientY],
            offsetDelta: [ne.offsetX - prev.offsetX, ne.offsetY - prev.offsetY],
            movement: [
              ne.clientX - source.clientX,
              ne.clientY - source.clientY,
            ],
            offsetMovement: [
              ne.offsetX - source.offsetX,
              ne.offsetY - source.offsetY,
            ],
          })
        },
        onPointerCancel: (e) => {
          const ne = e.nativeEvent
          const source = startPosition.current
          const prev = prevPosition.current
          if (!source || !prev) return

          e.currentTarget.releasePointerCapture(ne.pointerId)
          startPosition.current = null
          prevPosition.current = null

          handlerRef({
            event: e,
            first: false,
            last: true,
            canceled: true,
            initial: [ne.clientX, ne.clientY],
            offsetInitial: [ne.offsetX, ne.offsetY],
            delta: [0, 0],
            offsetDelta: [0, 0],
            movement: [0, 0],
            offsetMovement: [0, 0],
          })
        },
      }) satisfies DOMAttributes<Element>,
    [],
  )

  return useMemo(() => () => handlers, [])
}
