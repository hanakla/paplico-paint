import { MutableRefObject, RefCallback, RefObject } from 'react'

export const combineRef = (
  ...refs: (MutableRefObject<any> | RefCallback<any>)[]
) => {
  return (element: any) => {
    refs.forEach((ref) => {
      typeof ref === 'function' ? ref(element) : (ref.current = element)
    })
  }
}
