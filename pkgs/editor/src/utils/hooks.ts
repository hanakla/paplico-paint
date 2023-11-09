import {
  DependencyList,
  useInsertionEffect,
  useMemo,
  useReducer,
  useRef,
  DOMAttributes,
  PointerEvent,
} from 'react'
import { shallowEquals } from './object'

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

export const usePropsMemo = () => {
  const store = useMemo(
    () => new Map<string, { prev: DependencyList; value: any }>(),
    [],
  )

  return useMemo(
    () => ({
      memo: <T extends (() => any) | object | any[]>(
        key: string,
        value: T,
        deps: DependencyList,
      ) => {
        const prev = store.get(key)
        let returnValue = prev?.value

        if (prev == null || !shallowEquals(prev.prev, deps)) {
          returnValue = typeof value === 'function' ? value() : value
          store.set(key, { prev: deps, value: returnValue })
        }

        return returnValue
      },
    }),
    [],
  )
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

export function usePointerDrag(handler: (e: DragGestureEvent) => void) {
  const handlerRef = useStableRef(handler)
  const startPosition = useRef<{
    clientX: number
    clientY: number
    offsetX: number
    offsetY: number
  } | null>(null)

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

          e.currentTarget.setPointerCapture(e.pointerId)

          handlerRef.current({
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
          const source = startPosition.current
          if (!source) return

          const event = e.nativeEvent

          console.log({
            x: event.offsetX,
            y: event.offsetY,
            sx: source.offsetX,
            sy: source.offsetY,
          })

          handlerRef.current({
            event: e,
            first: false,
            last: false,
            canceled: false,
            initial: [source.clientX, source.clientY],
            offsetInitial: [source.offsetX, source.offsetY],
            delta: [
              event.clientX - source.clientX,
              event.clientY - source.clientY,
            ],
            offsetDelta: [
              event.offsetX - source.offsetX,
              event.offsetY - source.offsetY,
            ],
            movement: [
              event.clientX - source.clientX,
              event.clientY - source.clientY,
            ],
            offsetMovement: [
              event.offsetX - source.offsetX,
              event.offsetY - source.offsetY,
            ],
          })
        },
        onPointerUp: (e) => {
          const source = startPosition.current
          if (!source) return

          const event = e.nativeEvent
          e.currentTarget.releasePointerCapture(event.pointerId)
          startPosition.current = null

          handlerRef.current({
            event: e,
            first: false,
            last: true,
            canceled: false,
            initial: [source.clientX, source.clientY],
            offsetInitial: [source.offsetX, source.offsetY],
            delta: [
              event.clientX - source.clientX,
              event.clientY - source.clientY,
            ],
            offsetDelta: [
              event.offsetX - source.offsetX,
              event.offsetY - source.offsetY,
            ],
            movement: [
              event.clientX - source.clientX,
              event.clientY - source.clientY,
            ],
            offsetMovement: [
              event.offsetX - source.offsetX,
              event.offsetY - source.offsetY,
            ],
          })
        },
        onPointerCancel: (e) => {
          const source = startPosition.current
          if (!source) return

          const event = e.nativeEvent
          e.currentTarget.releasePointerCapture(event.pointerId)
          startPosition.current = null

          handlerRef.current({
            event: e,
            first: false,
            last: true,
            canceled: true,
            initial: [event.clientX, event.clientY],
            offsetInitial: [event.offsetX, event.offsetY],
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

export const useStableRef = <T>(value: T) => {
  const stableRef = useRef<T>(value)

  useBrowserEffect(() => {
    stableRef.current = value
  }, [value])

  return stableRef
}
