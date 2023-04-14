import { ColorRGBA } from '@/Document'
import { VectorPathPoint } from '@/Document/LayerEntity/VectorPath'
import { Camera, WebGLRenderer } from 'three'

export interface InkClass {
  readonly id: string
  readonly version: string

  new (): IInk
}

export interface IInk {
  class: InkClass

  initialize(): Promise<void> | void
  getInkGenerator(ctx: any): InkGenerator
}

export interface InkGenerator {
  getColor(inkContext: {
    pointIndex: number
    points: VectorPathPoint[]
    pointAtLength: number
    totalLength: number
    baseColor: ColorRGBA
  }): ColorRGBA

  applyTexture(
    canvas: CanvasRenderingContext2D,
    context: {
      threeRenderer: WebGLRenderer
      threeCamera: Camera
    }
  ): void
}
