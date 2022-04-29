import { ForwardedRef, MutableRefObject, RefCallback, RefObject } from 'react'

export const combineRef = <T>(
  ...refs: (MutableRefObject<any> | RefCallback<any> | ForwardedRef<any>)[]
): MutableRefObject<T | null> => {
  return {
    set current(el: T | null) {
      refs.forEach((ref) => {
        if (!ref) return
        typeof ref === 'function' ? ref(el) : (ref.current = el)
      })
    },
  }
}
