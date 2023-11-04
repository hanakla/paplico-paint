import { ColorRGBA } from '@/Document'
import { VectorPathPoint } from '@/Document/LayerEntity/VectorPath'
import { Camera, WebGLRenderer } from 'three'

type InkMetadata = {
  readonly id: string
  readonly version: string
  readonly name: string
}

interface InkGetColorContext {
  pointIndex: number
  points: VectorPathPoint[]
  pointAtLength: number
  totalLength: number
  baseColor: ColorRGBA
  pixelRatio: number
}

interface InkApplyTextureContext {
  threeRenderer: WebGLRenderer
  threeCamera: Camera
}

export interface InkClass<T> {
  readonly metadata: InkMetadata
  getInitialSetting(): T
  new (): IInk<any>
}

export interface IInk<Setting> {
  readonly id: string

  /** @deprecated */
  class: InkClass<Setting>

  initialize(): Promise<void> | void
  getInkGenerator(ctx: any): InkGenerator
}

export interface InkGenerator {
  getColor(inkContext: InkGetColorContext): ColorRGBA

  applyTexture(
    destination: CanvasRenderingContext2D,
    context: InkApplyTextureContext,
  ): void
}

export const createInk = <T extends InkClass<any>>(Class: T): T => Class
