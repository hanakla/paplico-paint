import { shallowEquals } from '@paplico/shared-lib'
import { useRef, useSyncExternalStore } from 'react'
import { StoreApi } from 'zustand'

export const defaultSelector = <T>(s: T): T => s

export function createUseStore<S extends StoreApi<any>>(
  store: S,
): BoundedUseStore<S> {
  return <T>(selector: (s: ExtractState<S>) => T = defaultSelector) => {
    const selectorRef = useRef(selector)
    selectorRef.current = selector

    const prevRef = useRef<T | null>(null)

    let state = useSyncExternalStore(store.subscribe, () => {
      const next = selectorRef.current(store.getState())

      if (shallowEquals(next, prevRef.current)) {
        return prevRef.current
      }

      prevRef.current = next
      return next
    })

    return state
  }
}

export function storePicker<T extends object, K extends keyof T>(keys: K[]) {
  return (store: T) => {
    const result: Pick<T, K> = {} as any
    for (const key of keys) {
      result[key] = store[key]
    }
    return result
  }
}

// Zustand patching for optional selector type
export type BoundedUseStore<S extends StoreApi<any>> = {
  (): ExtractState<S>
  <U = void>(
    selector?: (state: ExtractState<S>) => U,
  ): U extends void ? ExtractState<S> : U
}

export type ExtractState<S> = S extends {
  getState: () => infer T
}
  ? T
  : never
