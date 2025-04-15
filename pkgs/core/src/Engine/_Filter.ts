import { LayerTypes } from '../DOM'
import { WebGLContext } from './WebGLContext'
import { Camera, WebGLRenderer } from 'three'

export interface FilterInitContext {
  gl: WebGLContext
}

export interface FilterContext<Settings = Record<string, any>> {
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
    | { missing: false; image: TexImageSource }
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
