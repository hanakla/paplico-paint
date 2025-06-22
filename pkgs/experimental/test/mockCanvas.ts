import { type Canvas, createCanvas } from '@napi-rs/canvas'

export type { Canvas as MockCanvas }
export const createMockCanvas = (width: number, height: number): Canvas => {
  const canvas = createCanvas(width, height)
  return canvas
}
