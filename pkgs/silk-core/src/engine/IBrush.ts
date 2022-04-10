import { WebGLRenderer, Camera } from 'three'
import { CurrentBrushSetting } from './CurrentBrushSetting'
import { IInk } from '../Inks/IInk'
import { Path } from '../SilkDOM/Path'
import { WebGLContext } from './WebGLContext'

export type BrushContext<T = unknown> = {
  context: CanvasRenderingContext2D
  threeRenderer: WebGLRenderer
  threeCamera: Camera
  path: Path
  ink: IInk
  brushSetting: CurrentBrushSetting & { specific: Partial<T> | null }
  destSize: { width: number; height: number }
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
