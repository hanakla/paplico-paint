import { ColorRGBA } from '@/Document'
import { VectorPathPoint } from '@/Document/LayerEntity/VectorPath'
import { Camera, WebGLRenderer } from 'three'

export type InkMetadata = {
  readonly id: string
  readonly version: string
  readonly name: string
}

export interface InkGetColorContext<T extends Record<string, any>> {
  pointIndex: number
  points: VectorPathPoint[]
  pointAtLength: number
  totalLength: number
  baseColor: ColorRGBA
  pixelRatio: number
  settings: T
}

export interface InkApplyTextureContext<
  SettingType extends Record<string, any>,
> {
  threeRenderer: WebGLRenderer
  threeCamera: Camera
  settings: SettingType
}

export interface InkClass<SettingType extends Record<string, any>> {
  readonly metadata: InkMetadata
  getInitialSetting(): SettingType
  new (): IInk<any>
}

export interface IInk<SettingType extends Record<string, any>> {
  readonly id: string

  initialize(): Promise<void> | void
  getInkGenerator(ctx: any): InkGenerator<SettingType>
}

export interface InkGenerator<SettingType extends Record<string, any>> {
  getColor(inkContext: InkGetColorContext<SettingType>): ColorRGBA

  applyTexture(
    destination: CanvasRenderingContext2D,
    context: InkApplyTextureContext<SettingType>,
  ): void
}

export const createInk = <T extends InkClass<any>>(Class: T): T => Class
