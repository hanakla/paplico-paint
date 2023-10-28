import type { WebGLRenderer, Camera } from 'three'
import type { VectorStrokeSetting, VectorPath } from '@/Document'
import type { RenderCycleLogger } from '../RenderCycleLogger'
import type { InkGenerator } from '../Ink'
import type { RenderPhase } from '../types'
import type { PaneSetState, PaplicoComponents } from '@/UI/PaneUI/index'
import type {
  AbstractComponentRenderer,
  VNode,
} from '@/UI/PaneUI/AbstractComponent'

export type BrushPaneContext<T> = {
  components: PaplicoComponents
  c: PaplicoComponents
  state: T
  setState: PaneSetState<T>
  h: AbstractComponentRenderer
}

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

export type BrushMetadata = {
  readonly id: string
  readonly version: string
  readonly name?: string
}

export interface BrushClass<T = any> {
  readonly metadata: BrushMetadata

  getInitialConfig(): any

  renderPane(context: BrushPaneContext<T>): VNode

  new (): IBrush
}

export interface IBrush<T = any> {
  initialize(context: {}): Promise<void>
  render(brushContext: BrushContext<T>): Promise<BrushLayoutData>
}

export const createBrush = <T extends BrushClass<any>>(Class: T) => Class
