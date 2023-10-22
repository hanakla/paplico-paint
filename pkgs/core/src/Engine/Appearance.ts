import { VectorPath } from '@/Document'

export interface IAppearance {
  id: string
  initialize(context: {}): Promise<void>

  transformPath?(path: VectorPath): void
  rasterFilter?(image: ImageBitmap): void
}

export interface AppearanceClass {
  readonly id: string
  readonly version: string
  readonly name?: string

  new (): IAppearance
}
