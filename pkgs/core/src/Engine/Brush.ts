import { WebGLRenderer, Camera } from 'three'
import { VectorStrokeSetting, VectorPath } from '@/Document'
import { RenderCycleLogger } from './RenderCycleLogger'
import { InkGenerator } from './Ink'
import { RenderPhase } from './types'

export type BrushContext<T extends Record<string, any>> = {
  abort: AbortSignal
  abortIfNeeded: () => never | void

  /** Render result destination canvas */
  destContext: CanvasRenderingContext2D
  threeRenderer: WebGLRenderer
  threeCamera: Camera
  // gl: WebGLContext
  /** Input path. this is cloned and freezed */
  path: VectorPath[]
  transform: {
    rotate: number
    scale: { x: number; y: number }
    translate: { x: number; y: number }
  }
  ink: InkGenerator
  brushSetting: VectorStrokeSetting<T | null>
  /** Expected destination canvas size */
  destSize: { width: number; height: number }
  /**
   * Hint for mixing color, it's contains back layers buffer of rendering stroke.
   * This canvas is readonly.
   */
  // hintInput: CanvasImageSource | null
  phase: RenderPhase
  logger: RenderCycleLogger
}

export type BrushLayoutData = {
  bbox: {
    left: number
    top: number
    right: number
    bottom: number
  }
}

export interface BrushClass {
  readonly id: string
  readonly version: string

  readonly initialConfig: any

  new (): IBrush
}

export interface IBrush {
  initialize(context: {}): Promise<void>
  render(brushContext: BrushContext<any>): Promise<BrushLayoutData>
}

export const createBrush = <T extends BrushClass>(Class: T) => Class
