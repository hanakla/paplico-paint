import WebGLContext from './WebGLContext'

export type FilterContext = {
  gl: WebGLContext
  source: TexImageSource
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
  initialize(): Promise<void>
  render(ctx: FilterContext): void
}
