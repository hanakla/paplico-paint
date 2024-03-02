import type { VNode } from '@/UI/PaneUI/AbstractComponent'
import { IFilterWebGLContext } from './FilterContextAbst'
import { RenderCycleLogger } from '../RenderCycleLogger'
import { RenderPhase } from '../types'
import { PaneUIRenderings } from '../PaneUIRenderings'
import { RenderPipeline } from '../RenderPipeline'
import { VisuElement } from '@/Document'

export type FilterPaneContext<T> = PaneUIRenderings.PaneUIContext<T>

export type FilterInitContext = {
  gl: IFilterWebGLContext
}

export type FilterInputSource = RenderPipeline.CompositionImageSource

export type RasterFilterContext<T extends Record<string, any>> = {
  abort: AbortSignal
  throwIfAborted: () => never | void

  gl: IFilterWebGLContext
  destSize: { width: number; height: number }
  pixelRatio: number

  /** Mutation safe copied object */
  settings: T
  phase: RenderPhase
  logger: RenderCycleLogger

  // requestLayerBitmap: (layerUid: string) => Promise<
  //   | {
  //       missing: true
  //     }
  //   | { missing: false; image: TexImageSource }
  // >
}

export interface IFilter<T extends Record<string, any>> {
  readonly id: string

  initialize(context: { gl: IFilterWebGLContext }): Promise<void>

  transformPath?(path: VisuElement.VectorPath): Promise<VisuElement.VectorPath>
  applyRasterFilter?(
    input: FilterInputSource,
    output: CanvasRenderingContext2D,
    ctx: RasterFilterContext<T>,
  ): Promise<void>
}

export type FilterMetadata = {
  readonly id: string
  readonly version: string
  readonly name?: string
}

export interface FilterClass<
  T extends Record<string, any> = Record<string, any>,
> {
  readonly metadata: FilterMetadata

  getInitialSetting(): T
  migrateSetting(previousVersion: string, config: any): T

  renderPane(context: PaneUIRenderings.PaneUIContext<T>): VNode

  new (): IFilter<T>
}

export const createFilter = <State extends Record<string, any>>(
  Class: FilterClass<State>,
) => Class
