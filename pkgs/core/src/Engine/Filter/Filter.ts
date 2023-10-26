import { LayerEntity, LayerNode, VectorPath } from '@/Document'
import {
  AbstractComponentRenderer,
  VComponent,
  VComponentProps,
  VNode,
} from '@/UI/PaneUI/AbstractComponent'
import { FilterWebGLContext } from './FilterContextAbst'
import { RenderCycleLogger } from '../RenderCycleLogger'
import { PaneSetState, PaplicoComponents } from '@/UI/PaneUI'
import { RenderPhase } from '../types'

export type FilterPaneContext<T> = {
  components: PaplicoComponents
  c: PaplicoComponents
  state: T
  setState: PaneSetState<T>
  h: AbstractComponentRenderer

  // getDocumentLayerNodes: () => readonly Readonly<LayerNode>[]
  // queryLayer: (query: {
  //   uid?: string
  //   layerType?: LayerEntity['layerType']
  //   hasFeature?: string
  // }) => readonly Readonly<LayerEntity>[]
}

export type FilterInitContext = {
  gl: FilterWebGLContext
}

export type RasterFilterContext<T extends Record<string, any>> = {
  abort: AbortSignal
  abortIfNeeded: () => never | void

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
  readonly filterName?: string
}

export interface FilterClass<T extends Record<string, any>> {
  readonly metadata: FilterMetadata

  getInitialConfig(): T
  migrateSetting(previousVersion: string, config: T): T

  renderPane(context: FilterPaneContext<T>): VNode

  new (): IFilter<T>
}

export const createFilter = <State extends Record<string, any>>(
  Class: FilterClass<State>,
) => Class
