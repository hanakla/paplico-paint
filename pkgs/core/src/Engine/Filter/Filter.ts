import { type VectorPath } from '@/Document'
import type { VNode } from '@/UI/PaneUI/AbstractComponent'
import { FilterWebGLContext } from './FilterContextAbst'
import { RenderCycleLogger } from '../RenderCycleLogger'
import { RenderPhase } from '../types'
import { PaneUIRenderings } from '../PaneUIRenderings'

export type FilterPaneContext<T> = PaneUIRenderings.PaneUIContext<T>

export type FilterInitContext = {
  gl: FilterWebGLContext
}

export type RasterFilterContext<T extends Record<string, any>> = {
  abort: AbortSignal
  throwIfAborted: () => never | void

  gl: FilterWebGLContext
  destSize: { width: number; height: number }
  pixelRatio: number

  /** Mutation safe copied object */
  filterSetting: T
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

  initialize(context: {}): Promise<void>

  transformPath?(path: VectorPath): Promise<VectorPath>
  applyRasterFilter?(
    input: TexImageSource,
    output: CanvasRenderingContext2D,
    ctx: RasterFilterContext<T>,
  ): Promise<void>
}

export type FilterMetadata = {
  readonly id: string
  readonly version: string
  readonly name?: string
}

export interface FilterClass<T extends Record<string, any>> {
  readonly metadata: FilterMetadata

  getInitialSetting(): T
  migrateSetting(previousVersion: string, config: any): T

  renderPane(context: PaneUIRenderings.PaneUIContext<T>): VNode

  new (): IFilter<T>
}

export const createFilter = <State extends Record<string, any>>(
  Class: FilterClass<State>,
) => Class
