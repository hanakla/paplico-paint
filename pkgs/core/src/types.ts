export type FlushOnlyCanvasRenderingContext2D = Omit<
  CanvasRenderingContext2D,
  'clearRect'
>
