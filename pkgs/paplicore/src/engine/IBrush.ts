import { WebGLRenderer, Camera } from 'three'
import { CurrentBrushSetting } from './CurrentBrushSetting'
import { IInk } from '../Inks/IInk'
import { Path } from '../DOM/Path'
import { WebGLContext } from './WebGLContext'

export type BrushContext<T = unknown> = {
  context: CanvasRenderingContext2D
  threeRenderer: WebGLRenderer
  threeCamera: Camera
  /** Input path. this is cloned and freezed */
  path: Path
  ink: IInk
  brushSetting: CurrentBrushSetting & { specific: Partial<T> | null }
  /** Expected destination canvas size */
  destSize: { width: number; height: number }
  /**
   * Hint for mixing color, it's contains back layers buffer of rendering stroke.
   * This canvas is readonly.
   */
  hintInput: CanvasImageSource | null
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
