import { IGeometry } from '../interfaces/IGeometry'

export class BufferGeometry implements IGeometry {
  protected vbo: WebGLBuffer | null = null
  protected ibo: WebGLBuffer | null = null
  protected attributes: IGeometry.RawBufferAttributes = {}

  constructor(
    protected buffer: ArrayLike<number>,
    protected indexBuffer?: ArrayLike<number>,
  ) {
    const me = this
    Object.defineProperty(this.attributes, 'aPosition', {
      configurable: false,
      enumerable: true,
      writable: false,
      value: Object.freeze({
        itemSize: 3,
        get buffer() {
          return buffer
        },
        bufferSubData: false,
      }),
    })
  }

  public get rawBuffer() {
    return this.buffer
  }

  public get vertexCount() {
    return this.indexBuffer ? this.indexBuffer.length : this.buffer.length / 3
  }

  public getAllAttributes() {
    return this.attributes
  }

  public setAttribute(
    name: string,
    buffer: Float32Array,
    itemSize: number,
    {
      bufferSubData = false,
      stride = 0,
      offset = 0,
    }: { bufferSubData?: boolean; stride?: number; offset?: number } = {},
  ) {
    if (buffer.length % itemSize !== 0) {
      throw new Error(
        `Buffer size (${buffer.length}) is not divisible by itemSize (${itemSize})`,
      )
    }

    this.attributes[name] = {
      bufferSubData,
      itemSize,
      buffer,
      stride,
      offset,
    }
  }

  public getAttribute(name: string) {
    return this.attributes[name]
  }

  public compile(gl: WebGL2RenderingContext) {
    if (this.vbo) {
      return {
        vertices: this.vbo,
        indices: this.ibo,
      }
    }

    const vbo = (this.vbo = gl.createBuffer())!
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.buffer),
      gl.STATIC_DRAW,
    )
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    let ibo: WebGLBuffer | null = null
    if (this.indexBuffer) {
      ibo = (this.ibo = gl.createBuffer())!
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Float32Array(this.indexBuffer),
        gl.STATIC_DRAW,
      )
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    }

    return { vertices: vbo, indices: ibo }
  }
}
