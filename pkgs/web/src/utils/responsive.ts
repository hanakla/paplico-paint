import styledMq from 'styled-media-query'

export const narrow = '768px'

export const mediaNarrow = styledMq.lessThan('768px' as any)

export const media = {
  pc: styledMq.greaterThan('768px' as any),
  narrow: styledMq.lessThan('768px' as any),
}

export function isIpadOS() {
  return (
    typeof navigator !== 'undefined' &&
    navigator?.maxTouchPoints > 2 &&
    /MacIntel/.test(navigator.platform)
  )
}
