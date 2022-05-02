import { LayerTypes } from '../DOM'
import { Camera, WebGLRenderer } from 'three'
import { WebGLContext } from './WebGLContext'

export type FilterInitContext = {
  gl: WebGLContext
}

export type FilterContext<Settings = Record<string, any>> = {
  gl: WebGLContext
  threeRenderer: WebGLRenderer
  threeCamera: Camera
  sourceLayer: LayerTypes
  source: HTMLCanvasElement
  dest: HTMLCanvasElement
  requestLayerBitmap: (layerUid: string) => Promise<
    | {
        missing: true
      }
    | { missing: false; image: ImageBitmap }
  >
  size: { width: number; height: number }
  /** Mutation safe copied object */
  settings: Settings
}

export interface FilterClass<T extends IFilter = IFilter> {
  readonly id: string
  new (): T
}

export interface IFilter<Settings = Record<string, any>> {
  get id(): string
  get initialConfig(): Settings
  initialize(context: FilterInitContext): Promise<void>
  render(ctx: FilterContext<Settings>): Promise<void>
}
