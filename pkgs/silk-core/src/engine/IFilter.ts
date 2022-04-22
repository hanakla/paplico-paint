import { LayerTypes } from '../SilkDOM'
import { Camera, WebGLRenderer } from 'three'
import { WebGLContext } from './WebGLContext'

export type FilterInitContext = {
  gl: WebGLContext
}

export type FilterContext = {
  gl: WebGLContext
  threeRenderer: WebGLRenderer
  threeCamera: Camera
  sourceLayer: LayerTypes
  source: HTMLCanvasElement
  dest: HTMLCanvasElement
  size: { width: number; height: number }
  settings: Record<string, any>
}

export interface FilterClass<T extends IFilter = IFilter> {
  readonly id: string
  new (): T
}

export interface IFilter {
  get id(): string
  get initialConfig(): Record<string, any>
  initialize(context: FilterInitContext): Promise<void>
  render(ctx: FilterContext): Promise<void>
}
