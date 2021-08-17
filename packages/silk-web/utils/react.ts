import { ForwardedRef, MutableRefObject, RefCallback, RefObject } from 'react'

export const combineRef = (
  ...refs: (MutableRefObject<any> | RefCallback<any> | ForwardedRef<any>)[]
) => {
  return (element: any) => {
    refs.forEach((ref) => {
      if (!ref) return
      typeof ref === 'function' ? ref(element) : (ref.current = element)
    })
  }
}
