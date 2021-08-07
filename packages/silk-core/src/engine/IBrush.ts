import { CurrentBrushSetting } from './BrushSetting'
import { IInk } from './Inks/IInk'
import { Stroke } from './Stroke'

export type BrushContext = {
  context: CanvasRenderingContext2D
  stroke: Stroke
  ink: IInk
  brushSetting: CurrentBrushSetting
}

export interface BrushClass {
  readonly id: string
  new (): IBrush
}

export interface IBrush {
  id: string

  initialize(): Promise<void>
  render(brushContext: BrushContext): void
}
