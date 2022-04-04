import { WebGLRenderer, Camera } from 'three'
import { CurrentBrushSetting } from './CurrentBrushSetting'
import { IInk } from './Inks/IInk'
import { Stroke } from './Stroke'
import WebGLContext from './WebGLContext'

export type BrushContext = {
  context: CanvasRenderingContext2D
  threeRenderer: WebGLRenderer
  threeCamera: Camera
  stroke: Stroke
  ink: IInk
  brushSetting: CurrentBrushSetting
  size: { width: number; height: number }
}

export interface BrushClass {
  readonly id: string
  new (): IBrush
}

export interface IBrush {
  id: string

  initialize(context: { gl: WebGLContext }): Promise<void>
  render(brushContext: BrushContext): void
}
