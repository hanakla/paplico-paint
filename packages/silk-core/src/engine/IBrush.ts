import { BrushSetting } from './BrushSetting'
import { IInk } from './Inks/IInk'
import { Stroke } from './Stroke'

export type BrushContext = {
  context: CanvasRenderingContext2D
  stroke: Stroke
  ink: IInk
  brushSetting: BrushSetting
}

export interface IBrush {
  id(): string

  initialize(): Promise<void>
  render(brushContext: BrushContext): void
}
