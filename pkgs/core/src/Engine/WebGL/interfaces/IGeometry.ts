export namespace IGeometry {
  export type RawBufferAttributes = Record<
    string,
    {
      itemSize: number
      buffer: Float32Array
      bufferSubData: boolean
      stride: number
      offset: number
    }
  >
}

export interface IGeometry {
  readonly vertexCount: number
  readonly rawBuffer: ArrayLike<number>

  getAllAttributes(): IGeometry.RawBufferAttributes
  setAttribute(name: string, buffer: Float32Array, itemSize: number): void
  getAttribute(name: string): IGeometry.RawBufferAttributes[string] | undefined

  compile(gl: WebGL2RenderingContext): {
    vertices: WebGLBuffer
    indices: WebGLBuffer | null
  }
}
