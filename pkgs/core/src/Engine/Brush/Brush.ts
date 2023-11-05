import type { WebGLRenderer, Camera } from 'three'
import type { VectorBrushSetting, VectorPath } from '@/Document'
import type { RenderCycleLogger } from '../RenderCycleLogger'
import type { InkGenerator } from '../Ink'
import type { RenderPhase } from '../types'
import type { VNode } from '@/UI/PaneUI/AbstractComponent'
import { PaneUIRenderings } from '../PaneUIRenderings'

export type BrushPaneContext<T> = PaneUIRenderings.PaneUIContext<T>

export type BrushContext<T extends Record<string | symbol, any>, M> = {
  abort: AbortSignal
  throwIfAborted: () => never | void

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
  brushSetting: VectorBrushSetting<T | null>
  /** Expected destination canvas size */
  destSize: { width: number; height: number }
  pixelRatio: number
  /**
   * Hint for mixing color, it's contains back layers buffer of rendering stroke.
   * This canvas is readonly.
   */
  // hintInput: CanvasImageSource | null
  phase: RenderPhase
  logger: RenderCycleLogger

  useMemoForPath: (
    vectorPath: VectorPath,
    factory: () => Promise<M>,
    deps: (number | boolean | string | null | undefined)[],
  ) => Promise<M>
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

  getInitialSetting(): any

  renderPane(context: PaneUIRenderings.PaneUIContext<T>): VNode

  new (): IBrush
}

export interface IBrush<
  Settings extends Record<string | symbol, any> = Record<string | symbol, any>,
  Memo = any,
> {
  initialize(context: {}): Promise<void>
  render(brushContext: BrushContext<Settings, Memo>): Promise<BrushLayoutData>
}

export const createBrush = <T extends BrushClass<any>>(Class: T) => Class
