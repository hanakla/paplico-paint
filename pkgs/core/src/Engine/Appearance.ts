import { VectorPath } from '@/Document'
import { PaneContext as _PaneContext } from '@/UI/PaneUI/index'
import { VNode } from '@/UI/PaneUI/AbstractComponent'

export namespace IAppearance {
  export type PaneContext<T> = _PaneContext<T>
}

export interface IAppearance<T> {
  initialize(context: {}): Promise<void>

  transformPath?(path: VectorPath): void
  rasterFilter?(image: ImageBitmap): void
}

export interface AppearanceClass<T> {
  readonly id: string
  readonly version: string
  readonly apparanceName?: string

  renderPane(context: _PaneContext<T>): VNode

  new (): IAppearance<T>
}

export const createAppearance = <State>(Class: AppearanceClass<State>) => Class

declare const a: _PaneContext<any>
