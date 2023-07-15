import { usePaplico } from './hooks/usePaplico'

export function PaintV3() {
  const { ref } = usePaplico()

  return (
    <div>
      <canvas ref={ref} />
    </div>
  )
}
