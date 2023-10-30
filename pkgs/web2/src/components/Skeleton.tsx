import { memo, useMemo } from 'react'

type Props = {
  width: number | string
  height: number | string
}

export const Skeleton = memo(function Skeleton({ width, height }: Props) {
  const style = useMemo(() => ({ width, height }), [width, height])

  return (
    <div aria-live="polite" style={style}>
      &zwnj;
    </div>
  )
})
